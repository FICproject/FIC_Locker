package com.connectinvest.investor.camera

import android.content.Context
import android.net.Uri
import android.util.AttributeSet
import android.util.Size
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import java.nio.ByteBuffer
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.*

data class DetectedPoint(val x: Float, val y: Float)

data class DetectedQuad(
    val tl: DetectedPoint,
    val tr: DetectedPoint,
    val br: DetectedPoint,
    val bl: DetectedPoint,
    val confidence: Double,
    val paperSize: String,
    val aspectRatio: Double
)

class InAppCameraView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    val previewView: PreviewView = PreviewView(context).apply {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        scaleType = PreviewView.ScaleType.FILL_CENTER
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    }

    private var imageCapture: ImageCapture? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var camera: Camera? = null
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var isTorchOn: Boolean = false

    // Real-Time Document Detection State
    private var lastAnalysisTimestamp = 0L
    private var lastSmoothedQuad: DetectedQuad? = null
    private var consecutiveMisses = 0

    var currentDetectedQuad: DetectedQuad? = null
        private set

    init {
        addView(previewView)
        InAppCameraModule.activeCameraView = this
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    private val measureAndLayout = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        )
        layout(left, top, right, bottom)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        previewView.layout(0, 0, right - left, bottom - top)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        InAppCameraModule.activeCameraView = this
        startCamera()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        if (InAppCameraModule.activeCameraView == this) {
            InAppCameraModule.activeCameraView = null
        }
        try {
            cameraProvider?.unbindAll()
        } catch (e: Exception) {}
        cameraExecutor.shutdown()
    }

    fun setTorch(enabled: Boolean) {
        isTorchOn = enabled
        camera?.cameraControl?.enableTorch(enabled)
    }

    fun startCamera() {
        val hasPerm = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.CAMERA
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!hasPerm) {
            postDelayed({ startCamera() }, 300)
            return
        }

        val reactContext = context as? ReactContext ?: return
        val activity = reactContext.currentActivity as? LifecycleOwner
        if (activity == null) {
            postDelayed({ startCamera() }, 200)
            return
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .build()

                imageAnalysis = ImageAnalysis.Builder()
                    .setTargetResolution(Size(640, 480))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .build().also { analysis ->
                        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            processAnalysisFrame(imageProxy)
                        }
                    }

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider?.unbindAll()
                camera = cameraProvider?.bindToLifecycle(
                    activity,
                    cameraSelector,
                    preview,
                    imageCapture,
                    imageAnalysis
                )

                if (isTorchOn) {
                    camera?.cameraControl?.enableTorch(true)
                }
            } catch (exc: Exception) {
                exc.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /**
     * Real-time Camera Frame Analyzer
     * Analyzes Y-plane (grayscale luminance) at ~12 FPS to detect paper quadrilateral
     */
    private fun processAnalysisFrame(imageProxy: ImageProxy) {
        val now = System.currentTimeMillis()
        if (now - lastAnalysisTimestamp < 80) {
            imageProxy.close()
            return
        }
        lastAnalysisTimestamp = now

        try {
            val yPlane = imageProxy.planes[0]
            val buffer = yPlane.buffer
            val frameW = imageProxy.width
            val frameH = imageProxy.height
            val rowStride = yPlane.rowStride
            val pixelStride = yPlane.pixelStride
            val rotationDegrees = imageProxy.imageInfo.rotationDegrees

            // 1. Native OpenCV Computer Vision Pipeline (Primary)
            val openCVResult = if (DocumentDetectorOpenCV.isReady()) {
                DocumentDetectorOpenCV.detectDocument(
                    buffer = buffer,
                    frameW = frameW,
                    frameH = frameH,
                    rowStride = rowStride,
                    pixelStride = pixelStride,
                    rotationDegrees = rotationDegrees
                )
            } else null

            // 2. Map coordinates or execute secondary analyzer
            val quad: DetectedQuad? = if (openCVResult != null) {
                mapOpenCVResultToView(openCVResult)
            } else {
                detectDocumentQuad(
                    buffer = buffer,
                    frameW = frameW,
                    frameH = frameH,
                    rowStride = rowStride,
                    pixelStride = pixelStride,
                    rotationDegrees = rotationDegrees
                )
            }

            post {
                if (quad != null) {
                    consecutiveMisses = 0
                    currentDetectedQuad = quad
                    emitDocumentDetectedEvent(quad)
                } else {
                    consecutiveMisses++
                    if (consecutiveMisses >= 2) {
                        currentDetectedQuad = null
                        lastSmoothedQuad = null
                        emitNoDocumentEvent()
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore frame parse errors
        } finally {
            imageProxy.close()
        }
    }

    /**
     * Transforms native OpenCV normalized points to PreviewView normalized coordinates
     * taking into account aspect-ratio scaling, center-cropping, and temporal smoothing.
     */
    private fun mapOpenCVResultToView(result: DocumentDetectorOpenCV.DetectionResult): DetectedQuad {
        val sensorPortraitW = 480f
        val sensorPortraitH = 640f

        val viewW = previewView.width.toFloat().coerceAtLeast(1f)
        val viewH = previewView.height.toFloat().coerceAtLeast(1f)

        val scale = max(viewW / sensorPortraitW, viewH / sensorPortraitH)
        val scaledW = sensorPortraitW * scale
        val scaledH = sensorPortraitH * scale
        val offsetX = (viewW - scaledW) / 2f
        val offsetY = (viewH - scaledH) / 2f

        fun mapPoint(p: DetectedPoint): DetectedPoint {
            val pixelX = p.x * scaledW + offsetX
            val pixelY = p.y * scaledH + offsetY
            return DetectedPoint(
                x = (pixelX / viewW).coerceIn(0.01f, 0.99f),
                y = (pixelY / viewH).coerceIn(0.01f, 0.99f)
            )
        }

        val normTL = mapPoint(result.tl)
        val normTR = mapPoint(result.tr)
        val normBR = mapPoint(result.br)
        val normBL = mapPoint(result.bl)

        // Exponential Moving Average (EMA) smoothing
        val prev = lastSmoothedQuad
        val smoothedTL: DetectedPoint
        val smoothedTR: DetectedPoint
        val smoothedBR: DetectedPoint
        val smoothedBL: DetectedPoint

        if (prev == null) {
            smoothedTL = normTL
            smoothedTR = normTR
            smoothedBR = normBR
            smoothedBL = normBL
        } else {
            val alpha = 0.40f
            smoothedTL = DetectedPoint(alpha * normTL.x + (1 - alpha) * prev.tl.x, alpha * normTL.y + (1 - alpha) * prev.tl.y)
            smoothedTR = DetectedPoint(alpha * normTR.x + (1 - alpha) * prev.tr.x, alpha * normTR.y + (1 - alpha) * prev.tr.y)
            smoothedBR = DetectedPoint(alpha * normBR.x + (1 - alpha) * prev.br.x, alpha * normBR.y + (1 - alpha) * prev.br.y)
            smoothedBL = DetectedPoint(alpha * normBL.x + (1 - alpha) * prev.bl.x, alpha * normBL.y + (1 - alpha) * prev.bl.y)
        }

        val quad = DetectedQuad(
            tl = smoothedTL,
            tr = smoothedTR,
            br = smoothedBR,
            bl = smoothedBL,
            confidence = result.confidence,
            paperSize = result.paperSize,
            aspectRatio = result.aspectRatio
        )
        lastSmoothedQuad = quad
        return quad
    }

    /**
     * Fast Document Contour & Quadrilateral Detection
     * Samples Y-plane down to 120x160 grid, executes Otsu thresholding,
     * extracts paper boundaries and corners, validates geometry, and normalizes.
     */
    private fun detectDocumentQuad(
        buffer: ByteBuffer,
        frameW: Int,
        frameH: Int,
        rowStride: Int,
        pixelStride: Int,
        rotationDegrees: Int
    ): DetectedQuad? {
        val gridW = 120
        val gridH = 160
        val grid = IntArray(gridW * gridH)

        // Downsample rotated frame into portrait grid
        for (gy in 0 until gridH) {
            for (gx in 0 until gridW) {
                val sx = when (rotationDegrees) {
                    90 -> (gy * (frameW - 1)) / (gridH - 1)
                    270 -> ((gridH - 1 - gy) * (frameW - 1)) / (gridH - 1)
                    else -> (gx * (frameW - 1)) / (gridW - 1)
                }.coerceIn(0, frameW - 1)

                val sy = when (rotationDegrees) {
                    90 -> ((gridW - 1 - gx) * (frameH - 1)) / (gridW - 1)
                    270 -> (gx * (frameH - 1)) / (gridW - 1)
                    else -> (gy * (frameH - 1)) / (gridH - 1)
                }.coerceIn(0, frameH - 1)

                val offset = sy * rowStride + sx * pixelStride
                grid[gy * gridW + gx] = buffer.get(offset).toInt() and 0xFF
            }
        }

        // Compute histogram and check contrast
        val hist = IntArray(256)
        var minLum = 255
        var maxLum = 0
        var totalCount = 0
        var sumLum = 0L

        for (y in 2 until gridH - 2) {
            for (x in 2 until gridW - 2) {
                val lum = grid[y * gridW + x]
                hist[lum]++
                if (lum < minLum) minLum = lum
                if (lum > maxLum) maxLum = lum
                sumLum += lum
                totalCount++
            }
        }

        val dynamicRange = maxLum - minLum
        // Minimum contrast range: rejects pitch black or perfectly uniform blank walls (< 25)
        if (dynamicRange < 25) {
            return null
        }

        // Otsu's Thresholding
        var sumB = 0.0
        var wB = 0.0
        var maxVariance = 0.0
        var threshold = (minLum + maxLum) / 2
        val totalPx = totalCount.toDouble()

        var sumAll = 0.0
        for (t in 0..255) sumAll += t * hist[t]

        for (t in 0..255) {
            wB += hist[t]
            if (wB == 0.0) continue
            val wF = totalPx - wB
            if (wF == 0.0) break

            sumB += t * hist[t]
            val mB = sumB / wB
            val mF = (sumAll - sumB) / wF
            val varianceBetween = wB * wF * (mB - mF) * (mB - mF)
            if (varianceBetween > maxVariance) {
                maxVariance = varianceBetween
                threshold = t
            }
        }

        // Compute total variance and Otsu separability criterion (between-class / total variance)
        val meanAll = sumAll / totalPx
        var totalVar = 0.0
        for (t in 0..255) {
            val diff = t - meanAll
            totalVar += diff * diff * hist[t]
        }

        val separability = if (totalVar > 1e-4) maxVariance / (totalVar * totalPx) else 0.0

        // Compute mean contrast between foreground and background at optimal threshold
        var optSumB = 0.0
        var optWB = 0.0
        for (t in 0 until threshold) {
            optWB += hist[t]
            optSumB += t * hist[t]
        }
        val optWF = totalPx - optWB
        if (optWB < 40 || optWF < 40) return null

        val meanBg = optSumB / optWB
        val meanFg = (sumAll - optSumB) / optWF
        val meanContrast = abs(meanFg - meanBg)

        // Rejects flat blank surfaces without document contrast
        if (separability < 0.10 || meanContrast < 12.0) {
            return null
        }

        // Determine if paper is brighter than surrounding table
        val paperIsBright = meanFg > meanBg

        // Multi-Modal Desk + Paper Optimization:
        // On light office desks (desk ~175, paper ~195), a single global Otsu separates
        // dark objects (cables, keyboards, chargers) from desk+paper together.
        // If the initial bright region covers > 52% of the frame, run secondary Otsu on the upper
        // luminance range to pinpoint the exact boundary between the light table and the white paper!
        var effectiveThreshold = threshold
        if (paperIsBright) {
            var initialBrightCount = 0
            for (y in 1 until gridH - 1) {
                for (x in 1 until gridW - 1) {
                    if (grid[y * gridW + x] >= threshold) initialBrightCount++
                }
            }
            val initialCoverage = initialBrightCount.toFloat() / (gridW * gridH)
            if (initialCoverage > 0.52f) {
                val subHist = hist.clone()
                for (t in 0 until threshold) subHist[t] = 0
                var subTotal = 0.0
                var subSumAll = 0.0
                for (t in threshold..255) {
                    subTotal += subHist[t]
                    subSumAll += t * subHist[t]
                }
                if (subTotal > 50) {
                    var subSumB = 0.0
                    var subWB = 0.0
                    var subMaxVar = 0.0
                    var thresh2 = threshold
                    for (t in threshold..255) {
                        subWB += subHist[t]
                        if (subWB == 0.0) continue
                        val subWF = subTotal - subWB
                        if (subWF == 0.0) break
                        subSumB += t * subHist[t]
                        val mB = subSumB / subWB
                        val mF = (subSumAll - subSumB) / subWF
                        val varB = subWB * subWF * (mB - mF) * (mB - mF)
                        if (varB > subMaxVar) {
                            subMaxVar = varB
                            thresh2 = t
                        }
                    }
                    var subPaperPixels = 0
                    for (y in 1 until gridH - 1) {
                        for (x in 1 until gridW - 1) {
                            if (grid[y * gridW + x] >= thresh2) subPaperPixels++
                        }
                    }
                    val subCoverage = subPaperPixels.toFloat() / (gridW * gridH)
                    if (subCoverage in 0.10f..0.82f) {
                        effectiveThreshold = thresh2
                    }
                }
            }
        }

        // Build paper mask
        val rawMask = BooleanArray(gridW * gridH)
        var paperPixels = 0

        for (y in 1 until gridH - 1) {
            for (x in 1 until gridW - 1) {
                val lum = grid[y * gridW + x]
                val isP = if (paperIsBright) lum >= effectiveThreshold else lum < effectiveThreshold
                rawMask[y * gridW + x] = isP
                if (isP) paperPixels++
            }
        }

        val coverage = paperPixels.toFloat() / (gridW * gridH)
        // Document must be framed within 8% to 90% of view
        if (coverage < 0.08f || coverage > 0.90f) {
            return null
        }

        // Margin Clearance Check: only reject if more than 45% of outer border touches (whole-frame gradient)
        var borderTouchCount = 0
        for (x in 0 until gridW) {
            if (rawMask[x]) borderTouchCount++
            if (rawMask[(gridH - 1) * gridW + x]) borderTouchCount++
        }
        for (y in 0 until gridH) {
            if (rawMask[y * gridW]) borderTouchCount++
            if (rawMask[y * gridW + (gridW - 1)]) borderTouchCount++
        }
        val totalBorderPx = 2 * (gridW + gridH)
        if (borderTouchCount.toFloat() / totalBorderPx > 0.45f) {
            return null
        }

        // 1-pixel morphological erosion to eliminate thin wires, cable shine, and noise
        val cleanMask = BooleanArray(gridW * gridH)
        var cleanCount = 0
        for (y in 2 until gridH - 2) {
            for (x in 2 until gridW - 2) {
                val idx = y * gridW + x
                if (rawMask[idx] &&
                    rawMask[idx - 1] && rawMask[idx + 1] &&
                    rawMask[idx - gridW] && rawMask[idx + gridW]) {
                    cleanMask[idx] = true
                    cleanCount++
                }
            }
        }

        if (cleanCount < (gridW * gridH * 0.10f)) {
            return null
        }

        // Find 4 extreme quadrilateral corner candidates
        var minTL = Float.MAX_VALUE
        var minTR = Float.MAX_VALUE
        var maxBR = Float.MIN_VALUE
        var minBL = Float.MAX_VALUE

        var rawTL = DetectedPoint(0f, 0f)
        var rawTR = DetectedPoint(0f, 0f)
        var rawBR = DetectedPoint(0f, 0f)
        var rawBL = DetectedPoint(0f, 0f)

        for (y in 3 until gridH - 3) {
            for (x in 3 until gridW - 3) {
                if (!cleanMask[y * gridW + x]) continue
                val xf = x.toFloat()
                val yf = y.toFloat()

                // Top-Left: min (x + y)
                val vTL = xf + yf
                if (vTL < minTL) {
                    minTL = vTL
                    rawTL = DetectedPoint(xf, yf)
                }

                // Top-Right: min ((gridW - 1 - x) + y)
                val vTR = (gridW - 1 - xf) + yf
                if (vTR < minTR) {
                    minTR = vTR
                    rawTR = DetectedPoint(xf, yf)
                }

                // Bottom-Right: max (x + y)
                val vBR = xf + yf
                if (vBR > maxBR) {
                    maxBR = vBR
                    rawBR = DetectedPoint(xf, yf)
                }

                // Bottom-Left: min (x + (gridH - 1 - y))
                val vBL = xf + (gridH - 1 - yf)
                if (vBL < minBL) {
                    minBL = vBL
                    rawBL = DetectedPoint(xf, yf)
                }
            }
        }

        // Validate quadrilateral geometry
        fun dist(p1: DetectedPoint, p2: DetectedPoint): Float {
            val dx = p1.x - p2.x
            val dy = p1.y - p2.y
            return sqrt(dx * dx + dy * dy)
        }

        val widthTop = dist(rawTL, rawTR)
        val widthBottom = dist(rawBL, rawBR)
        val heightLeft = dist(rawTL, rawBL)
        val heightRight = dist(rawTR, rawBR)

        if (widthTop < gridW * 0.22f || widthBottom < gridW * 0.22f ||
            heightLeft < gridH * 0.22f || heightRight < gridH * 0.22f) {
            return null
        }

        if (rawTR.x <= rawTL.x + 18f || rawBR.x <= rawBL.x + 18f ||
            rawBL.y <= rawTL.y + 22f || rawBR.y <= rawTR.y + 22f) {
            return null
        }

        // Perspective symmetry: opposite edges cannot differ wildly
        val ratioTopBottom = max(widthTop, widthBottom) / min(widthTop, widthBottom).coerceAtLeast(1f)
        val ratioLeftRight = max(heightLeft, heightRight) / min(heightLeft, heightRight).coerceAtLeast(1f)
        if (ratioTopBottom > 1.55f || ratioLeftRight > 1.55f) {
            return null
        }

        // Reject if an entire edge is pinned to the image margin (e.g. ambient lighting cut off by frame)
        if ((rawTL.y <= 3f && rawTR.y <= 3f) ||
            (rawBL.y >= gridH - 4f && rawBR.y >= gridH - 4f) ||
            (rawTL.x <= 3f && rawBL.x <= 3f) ||
            (rawTR.x >= gridW - 4f && rawBR.x >= gridW - 4f)) {
            return null
        }

        // Shoelace area calculation
        val quadArea = 0.5f * abs(
            (rawTL.x * rawTR.y - rawTR.x * rawTL.y) +
            (rawTR.x * rawBR.y - rawBR.x * rawTR.y) +
            (rawBR.x * rawBL.y - rawBR.x * rawBL.y) +
            (rawBL.x * rawTL.y - rawTL.x * rawBL.y)
        )

        val totalGridArea = (gridW * gridH).toFloat()
        if (quadArea < totalGridArea * 0.08f || quadArea > totalGridArea * 0.92f) {
            return null
        }

        // Fill ratio: on a real document, the detected quad is filled with paper pixels
        val fillRatio = cleanCount.toFloat() / quadArea.coerceAtLeast(1f)
        if (fillRatio < 0.50f || fillRatio > 1.50f) {
            return null
        }

        // Edge Gradient Verification:
        // Sample luminance step between inside and outside points across all 4 edges.
        // A true paper border has a sharp contrast step.
        // A plain wall or smooth gradient has an edge step of only 1 - 3 across pixels.
        val cX = (rawTL.x + rawTR.x + rawBR.x + rawBL.x) / 4f
        val cY = (rawTL.y + rawTR.y + rawBR.y + rawBL.y) / 4f

        fun sampleEdgeContrast(p1: DetectedPoint, p2: DetectedPoint): Float {
            var totalStep = 0f
            var sampleCount = 0
            val steps = 6
            for (i in 1 until steps) {
                val t = i.toFloat() / steps
                val edgeX = p1.x + t * (p2.x - p1.x)
                val edgeY = p1.y + t * (p2.y - p1.y)

                val vX = edgeX - cX
                val vY = edgeY - cY
                val len = sqrt(vX * vX + vY * vY).coerceAtLeast(1f)
                val dirX = vX / len
                val dirY = vY / len

                val inX = (edgeX - dirX * 3f).toInt().coerceIn(0, gridW - 1)
                val inY = (edgeY - dirY * 3f).toInt().coerceIn(0, gridH - 1)
                val outX = (edgeX + dirX * 3f).toInt().coerceIn(0, gridW - 1)
                val outY = (edgeY + dirY * 3f).toInt().coerceIn(0, gridH - 1)

                val lumIn = grid[inY * gridW + inX]
                val lumOut = grid[outY * gridW + outX]

                totalStep += abs(lumIn - lumOut)
                sampleCount++
            }
            return if (sampleCount > 0) totalStep / sampleCount else 0f
        }

        val contrastTop = sampleEdgeContrast(rawTL, rawTR)
        val contrastRight = sampleEdgeContrast(rawTR, rawBR)
        val contrastBottom = sampleEdgeContrast(rawBR, rawBL)
        val contrastLeft = sampleEdgeContrast(rawBL, rawTL)

        val avgContrast = (contrastTop + contrastRight + contrastBottom + contrastLeft) / 4f
        // Reject false quad if border edges are not sharp (wall is < 5f)
        if (avgContrast < 8.0f) {
            return null
        }

        var sharpEdges = 0
        if (contrastTop >= 6.5f) sharpEdges++
        if (contrastRight >= 6.5f) sharpEdges++
        if (contrastBottom >= 6.5f) sharpEdges++
        if (contrastLeft >= 6.5f) sharpEdges++
        if (sharpEdges < 2) {
            return null
        }

        val avgW = (widthTop + widthBottom) / 2f
        val avgH = (heightLeft + heightRight) / 2f
        val ratio = (max(avgW, avgH) / min(avgW, avgH).coerceAtLeast(1f)).toDouble()

        if (ratio < 1.05 || ratio > 2.2) {
            return null
        }

        // Map from Grid coordinates into PreviewView normalized [0.0 .. 1.0] coordinates
        val sensorPortraitW = 480f
        val sensorPortraitH = 640f

        val viewW = previewView.width.toFloat().coerceAtLeast(1f)
        val viewH = previewView.height.toFloat().coerceAtLeast(1f)

        val scale = max(viewW / sensorPortraitW, viewH / sensorPortraitH)
        val scaledW = sensorPortraitW * scale
        val scaledH = sensorPortraitH * scale
        val offsetX = (viewW - scaledW) / 2f
        val offsetY = (viewH - scaledH) / 2f

        fun mapPointToViewNorm(p: DetectedPoint): DetectedPoint {
            val normGridX = p.x / gridW
            val normGridY = p.y / gridH

            val pixelX = normGridX * scaledW + offsetX
            val pixelY = normGridY * scaledH + offsetY

            return DetectedPoint(
                x = (pixelX / viewW).coerceIn(0.01f, 0.99f),
                y = (pixelY / viewH).coerceIn(0.01f, 0.99f)
            )
        }

        val normTL = mapPointToViewNorm(rawTL)
        val normTR = mapPointToViewNorm(rawTR)
        val normBR = mapPointToViewNorm(rawBR)
        val normBL = mapPointToViewNorm(rawBL)

        // Smooth with previous frame using Exponential Moving Average (EMA)
        val smoothedTL: DetectedPoint
        val smoothedTR: DetectedPoint
        val smoothedBR: DetectedPoint
        val smoothedBL: DetectedPoint

        val prev = lastSmoothedQuad
        if (prev == null) {
            smoothedTL = normTL
            smoothedTR = normTR
            smoothedBR = normBR
            smoothedBL = normBL
        } else {
            val alpha = 0.40f
            smoothedTL = DetectedPoint(alpha * normTL.x + (1 - alpha) * prev.tl.x, alpha * normTL.y + (1 - alpha) * prev.tl.y)
            smoothedTR = DetectedPoint(alpha * normTR.x + (1 - alpha) * prev.tr.x, alpha * normTR.y + (1 - alpha) * prev.tr.y)
            smoothedBR = DetectedPoint(alpha * normBR.x + (1 - alpha) * prev.br.x, alpha * normBR.y + (1 - alpha) * prev.br.y)
            smoothedBL = DetectedPoint(alpha * normBL.x + (1 - alpha) * prev.bl.x, alpha * normBL.y + (1 - alpha) * prev.bl.y)
        }

        // Classify Paper Size Standard
        val paperSize = when {
            abs(ratio - 1.414) <= 0.12 -> "A4"
            abs(ratio - 1.294) <= 0.08 -> "Letter"
            abs(ratio - 1.586) <= 0.10 -> "ID"
            abs(ratio - 1.647) <= 0.09 -> "Legal"
            else -> if (ratio in 1.15..1.6) "A4" else "Custom"
        }

        val confidence = (1.0 - min(abs(ratio - 1.414), 0.2) * 0.5).coerceIn(0.85, 0.98)

        val detectedQuad = DetectedQuad(
            tl = smoothedTL,
            tr = smoothedTR,
            br = smoothedBR,
            bl = smoothedBL,
            confidence = Math.round(confidence * 100.0) / 100.0,
            paperSize = paperSize,
            aspectRatio = Math.round(ratio * 100.0) / 100.0
        )
        lastSmoothedQuad = detectedQuad
        return detectedQuad
    }

    private fun emitDocumentDetectedEvent(quad: DetectedQuad) {
        val reactContext = context as? ReactContext ?: return
        try {
            val event = Arguments.createMap().apply {
                putBoolean("detected", true)
                putString("paperSize", quad.paperSize)
                putDouble("confidence", quad.confidence)
                putDouble("aspectRatio", quad.aspectRatio)

                val corners = Arguments.createMap().apply {
                    putMap("tl", Arguments.createMap().apply {
                        putDouble("x", quad.tl.x.toDouble())
                        putDouble("y", quad.tl.y.toDouble())
                    })
                    putMap("tr", Arguments.createMap().apply {
                        putDouble("x", quad.tr.x.toDouble())
                        putDouble("y", quad.tr.y.toDouble())
                    })
                    putMap("br", Arguments.createMap().apply {
                        putDouble("x", quad.br.x.toDouble())
                        putDouble("y", quad.br.y.toDouble())
                    })
                    putMap("bl", Arguments.createMap().apply {
                        putDouble("x", quad.bl.x.toDouble())
                        putDouble("y", quad.bl.y.toDouble())
                    })
                }
                putMap("corners", corners)
            }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(id, "onDocumentDetected", event)
        } catch (e: Exception) {}
    }

    private fun emitNoDocumentEvent() {
        val reactContext = context as? ReactContext ?: return
        try {
            val event = Arguments.createMap().apply {
                putBoolean("detected", false)
            }
            reactContext
                .getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(id, "onDocumentDetected", event)
        } catch (e: Exception) {}
    }

    fun capturePhoto(onSuccess: (String, Int, Int) -> Unit, onError: (String) -> Unit) {
        val capture = imageCapture
        if (capture == null) {
            onError("Camera is not ready yet.")
            return
        }

        val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val outputDirectory = context.cacheDir
        val photoFile = File(outputDirectory, "FIC_SCAN_$name.jpg")

        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onError(exc: ImageCaptureException) {
                    onError(exc.message ?: "Failed to capture photo")
                }

                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val savedUri = Uri.fromFile(photoFile).toString()
                    onSuccess(savedUri, 1920, 1080)
                }
            }
        )
    }
}
