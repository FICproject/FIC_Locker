package com.connectinvest.investor.camera

import android.graphics.Bitmap
import android.util.Log
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.nio.ByteBuffer
import kotlin.math.*

/**
 * Professional OpenCV Native Document Detection & Perspective Processing Engine
 *
 * Employs a multi-strategy document edge and boundary discovery pipeline:
 * 1. Aspect-ratio preserving downsampling
 * 2. Gaussian smoothing to suppress fine textures while preserving outer contours
 * 3. Multi-strategy paper segmentation:
 *    - Strategy A: Otsu binarization with morphological text closure (bridges interior text)
 *    - Strategy B: Adaptive Gaussian thresholding (handles uneven lighting and shadows)
 *    - Strategy C: High-luminance thresholding (detects white paper on light/wood desks)
 *    - Strategy D: Canny edge gradient with morphological boundary closure
 * 4. External contour extraction on closed silhouettes
 * 5. Convex hull calculation to prevent finger/cable notches from breaking quadrilateral
 * 6. Multi-scale approxPolyDP polygon approximation with minAreaRect fallback
 * 7. Centroid polar angle corner ordering (invariant to tilt and rotation)
 * 8. Candidate scoring and sub-pixel perspective transformation
 */
object DocumentDetectorOpenCV {

    private const val TAG = "DocumentDetectorOpenCV"
    private var isOpenCVInitialized = false

    init {
        tryInit()
    }

    private fun tryInit(): Boolean {
        if (isOpenCVInitialized) return true
        try {
            isOpenCVInitialized = OpenCVLoader.initDebug()
            if (isOpenCVInitialized) {
                Log.i(TAG, "OpenCV native library successfully initialized via initDebug().")
                return true
            }
        } catch (e: Throwable) {
            Log.w(TAG, "OpenCVLoader.initDebug() failed, trying System.loadLibrary...", e)
        }

        try {
            System.loadLibrary("opencv_java4")
            isOpenCVInitialized = true
            Log.i(TAG, "OpenCV native library loaded via System.loadLibrary(opencv_java4).")
            return true
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to load opencv_java4 native library", e)
        }
        return false
    }

    fun isReady(): Boolean = isOpenCVInitialized || tryInit()

    data class DetectionResult(
        val tl: DetectedPoint,
        val tr: DetectedPoint,
        val br: DetectedPoint,
        val bl: DetectedPoint,
        val confidence: Double,
        val paperSize: String,
        val aspectRatio: Double,
        val isTilted: Boolean,
        val isPartiallyVisible: Boolean,
        val isTooFar: Boolean,
        val processingTimeMs: Long
    )

    /**
     * Analyzes raw Y-plane buffer from live camera preview
     */
    fun detectDocument(
        buffer: ByteBuffer,
        frameW: Int,
        frameH: Int,
        rowStride: Int,
        pixelStride: Int,
        rotationDegrees: Int
    ): DetectionResult? {
        if (!isReady()) return null
        val startTime = System.currentTimeMillis()

        var rawMat: Mat? = null
        var rotatedMat: Mat? = null

        try {
            rawMat = Mat(frameH, frameW, CvType.CV_8UC1)
            val yBytes = ByteArray(frameW * frameH)

            if (rowStride == frameW && pixelStride == 1) {
                buffer.position(0)
                buffer.get(yBytes, 0, frameW * frameH)
            } else {
                var offset = 0
                val cap = buffer.capacity()
                for (row in 0 until frameH) {
                    val pos = row * rowStride
                    if (pos + frameW <= cap) {
                        buffer.position(pos)
                        buffer.get(yBytes, offset, frameW)
                    }
                    offset += frameW
                }
            }
            rawMat.put(0, 0, yBytes)

            // Rotate Mat to match upright sensor orientation
            rotatedMat = Mat()
            when (rotationDegrees) {
                90 -> Core.rotate(rawMat, rotatedMat, Core.ROTATE_90_CLOCKWISE)
                180 -> Core.rotate(rawMat, rotatedMat, Core.ROTATE_180)
                270 -> Core.rotate(rawMat, rotatedMat, Core.ROTATE_90_COUNTERCLOCKWISE)
                else -> rawMat.copyTo(rotatedMat)
            }

            val result = analyzeGrayscaleMat(rotatedMat, isLiveStream = true)
            return if (result != null) {
                result.copy(processingTimeMs = System.currentTimeMillis() - startTime)
            } else null
        } catch (e: Exception) {
            Log.w(TAG, "Live OpenCV detection error:", e)
            return null
        } finally {
            rawMat?.release()
            rotatedMat?.release()
        }
    }

    /**
     * Analyzes full-resolution captured Bitmap directly
     */
    fun detectDocumentBitmap(bitmap: Bitmap): DetectionResult? {
        if (!isReady()) return null
        val startTime = System.currentTimeMillis()

        var rgbaMat: Mat? = null
        var grayMat: Mat? = null

        try {
            rgbaMat = Mat()
            Utils.bitmapToMat(bitmap, rgbaMat)

            grayMat = Mat()
            if (rgbaMat.channels() >= 3) {
                Imgproc.cvtColor(rgbaMat, grayMat, Imgproc.COLOR_RGBA2GRAY)
            } else {
                rgbaMat.copyTo(grayMat)
            }

            val result = analyzeGrayscaleMat(grayMat, isLiveStream = false)
            return if (result != null) {
                result.copy(processingTimeMs = System.currentTimeMillis() - startTime)
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "Bitmap OpenCV detection error:", e)
            return null
        } finally {
            rgbaMat?.release()
            grayMat?.release()
        }
    }

    /**
     * Core Computer Vision Quadrilateral Detection Algorithm
     */
    private fun analyzeGrayscaleMat(srcGray: Mat, isLiveStream: Boolean): DetectionResult? {
        val origW = srcGray.cols()
        val origH = srcGray.rows()
        if (origW < 50 || origH < 50) return null

        // Downsample maintaining exact aspect ratio for fast analysis
        val maxSide = if (isLiveStream) 420.0 else 800.0
        val scale = maxSide / max(origW, origH)
        val targetW = (origW * scale).roundToInt().coerceAtLeast(100)
        val targetH = (origH * scale).roundToInt().coerceAtLeast(100)

        var resized: Mat? = null
        var blurred: Mat? = null

        // Structuring elements
        var k3: Mat? = null
        var k5: Mat? = null
        var k9: Mat? = null

        try {
            resized = Mat()
            Imgproc.resize(srcGray, resized, Size(targetW.toDouble(), targetH.toDouble()), 0.0, 0.0, Imgproc.INTER_AREA)

            blurred = Mat()
            Imgproc.GaussianBlur(resized, blurred, Size(5.0, 5.0), 0.0)

            k3 = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(3.0, 3.0))
            k5 = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(5.0, 5.0))
            k9 = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(9.0, 9.0))

            val totalArea = (targetW * targetH).toDouble()
            val totalMeanLum = Core.mean(blurred).`val`[0]

            var bestScore = 0.0
            var bestCorners: Array<Point>? = null
            var bestPaperSize = "A4"
            var bestAspectRatio = 1.414

            // List of candidate binary/edge masks to test
            val candidateMasks = ArrayList<Mat>()

            // Strategy 1: Otsu Thresholding with Morphological Close (Fills all text inside document)
            try {
                val binOtsu = Mat()
                Imgproc.threshold(blurred, binOtsu, 0.0, 255.0, Imgproc.THRESH_BINARY or Imgproc.THRESH_OTSU)
                val closedOtsu = Mat()
                Imgproc.morphologyEx(binOtsu, closedOtsu, Imgproc.MORPH_CLOSE, k9)
                candidateMasks.add(closedOtsu)
                binOtsu.release()
            } catch (e: Exception) {}

            // Strategy 2: Adaptive Thresholding with Morphological Close (Shadows & uneven lighting)
            try {
                val binAdapt = Mat()
                Imgproc.adaptiveThreshold(
                    blurred,
                    binAdapt,
                    255.0,
                    Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
                    Imgproc.THRESH_BINARY,
                    25,
                    8.0
                )
                val closedAdapt = Mat()
                Imgproc.morphologyEx(binAdapt, closedAdapt, Imgproc.MORPH_CLOSE, k9)
                candidateMasks.add(closedAdapt)
                binAdapt.release()
            } catch (e: Exception) {}

            // Strategy 3: High Luminance Threshold (White paper on light gray/wood office desks)
            try {
                val highThresh = min(240.0, max(140.0, totalMeanLum + 20.0))
                val binHigh = Mat()
                Imgproc.threshold(blurred, binHigh, highThresh, 255.0, Imgproc.THRESH_BINARY)
                val closedHigh = Mat()
                Imgproc.morphologyEx(binHigh, closedHigh, Imgproc.MORPH_CLOSE, k9)
                candidateMasks.add(closedHigh)
                binHigh.release()
            } catch (e: Exception) {}

            // Strategy 4: Canny Edge Detection with Morphological Closing
            try {
                val cannyEdges = Mat()
                Imgproc.Canny(blurred, cannyEdges, 35.0, 95.0)
                val closedCanny = Mat()
                Imgproc.morphologyEx(cannyEdges, closedCanny, Imgproc.MORPH_CLOSE, k5)
                candidateMasks.add(closedCanny)
                cannyEdges.release()
            } catch (e: Exception) {}

            // Process all candidate masks
            for (mask in candidateMasks) {
                val contours = ArrayList<MatOfPoint>()
                val hierarchy = Mat()
                Imgproc.findContours(mask, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
                hierarchy.release()

                for (contour in contours) {
                    val area = Imgproc.contourArea(contour)
                    val areaRatio = area / totalArea

                    // Document must occupy between 6% and 94% of frame
                    if (areaRatio < 0.06 || areaRatio > 0.94) {
                        contour.release()
                        continue
                    }

                    val bRect = Imgproc.boundingRect(contour)
                    // Reject full viewfinder border hugging artifacts
                    if (bRect.x <= 2 && bRect.y <= 2 && (bRect.x + bRect.width) >= targetW - 2 && (bRect.y + bRect.height) >= targetH - 2) {
                        contour.release()
                        continue
                    }

                    // Compute convex hull
                    val hullMatOfInt = MatOfInt()
                    Imgproc.convexHull(contour, hullMatOfInt)
                    val contourPts = contour.toArray()
                    val hullIndices = hullMatOfInt.toArray()
                    val hullPts = Array(hullIndices.size) { i -> contourPts[hullIndices[i]] }
                    hullMatOfInt.release()

                    val hullContour = MatOfPoint(*hullPts)
                    val hull2f = MatOfPoint2f(*hullPts)
                    val peri = Imgproc.arcLength(hull2f, true)
                    var quadPts: Array<Point>? = null

                    // Test polygon approximations
                    val tolerances = doubleArrayOf(0.015, 0.020, 0.025, 0.030, 0.040, 0.055, 0.070, 0.085)
                    for (factor in tolerances) {
                        val approx2f = MatOfPoint2f()
                        Imgproc.approxPolyDP(hull2f, approx2f, factor * peri, true)

                        if (approx2f.total() == 4L) {
                            val pts = approx2f.toArray()
                            val approxInt = MatOfPoint(*pts)
                            if (Imgproc.isContourConvex(approxInt)) {
                                quadPts = pts
                                approxInt.release()
                                approx2f.release()
                                break
                            }
                            approxInt.release()
                        }
                        approx2f.release()
                    }

                    // Fallback to minAreaRect if approxPolyDP had slight corner irregularities
                    if (quadPts == null && areaRatio in 0.08..0.90) {
                        val rotRect = Imgproc.minAreaRect(hull2f)
                        val rectPts = Array(4) { Point() }
                        rotRect.points(rectPts)
                        quadPts = rectPts
                    }

                    hullContour.release()
                    hull2f.release()

                    if (quadPts != null) {
                        val ordered = orderCorners(quadPts)
                        val score = evaluateCandidate(ordered, targetW, targetH, areaRatio, blurred, totalMeanLum)

                        if (score > bestScore && score >= 28.0) {
                            bestScore = score
                            bestCorners = ordered

                            val wTop = dist(ordered[0], ordered[1])
                            val wBot = dist(ordered[3], ordered[2])
                            val hLeft = dist(ordered[0], ordered[3])
                            val hRight = dist(ordered[1], ordered[2])
                            val avgW = (wTop + wBot) / 2.0
                            val avgH = (hLeft + hRight) / 2.0
                            bestAspectRatio = max(avgW, avgH) / max(1.0, min(avgW, avgH))

                            bestPaperSize = when {
                                abs(bestAspectRatio - 1.414) <= 0.12 -> "A4"
                                abs(bestAspectRatio - 1.294) <= 0.08 -> "Letter"
                                abs(bestAspectRatio - 1.586) <= 0.10 -> "ID"
                                abs(bestAspectRatio - 1.647) <= 0.09 -> "Legal"
                                else -> if (bestAspectRatio in 1.15..1.75) "A4" else "Custom"
                            }
                        }
                    }

                    contour.release()
                }

                mask.release()
            }

            if (bestCorners == null) return null

            // Normalized Coordinates in [0.0 .. 1.0] in upright sensor space
            val normTL = DetectedPoint(
                (bestCorners[0].x / targetW).toFloat().coerceIn(0f, 1f),
                (bestCorners[0].y / targetH).toFloat().coerceIn(0f, 1f)
            )
            val normTR = DetectedPoint(
                (bestCorners[1].x / targetW).toFloat().coerceIn(0f, 1f),
                (bestCorners[1].y / targetH).toFloat().coerceIn(0f, 1f)
            )
            val normBR = DetectedPoint(
                (bestCorners[2].x / targetW).toFloat().coerceIn(0f, 1f),
                (bestCorners[2].y / targetH).toFloat().coerceIn(0f, 1f)
            )
            val normBL = DetectedPoint(
                (bestCorners[3].x / targetW).toFloat().coerceIn(0f, 1f),
                (bestCorners[3].y / targetH).toFloat().coerceIn(0f, 1f)
            )

            // Margin clearance check (< 1% from frame boundary)
            val isPartial = normTL.x < 0.01f || normTL.y < 0.01f ||
                    normTR.x > 0.99f || normTR.y < 0.01f ||
                    normBR.x > 0.99f || normBR.y > 0.99f ||
                    normBL.x < 0.01f || normBL.y > 0.99f

            // Area too far check (< 7% of frame)
            val normArea = 0.5f * abs(
                (normTL.x * normTR.y - normTR.x * normTL.y) +
                (normTR.x * normBR.y - normBR.x * normTR.y) +
                (normBR.x * normBL.y - normBR.x * normBL.y) +
                (normBL.x * normTL.y - normBL.x * normTL.y)
            )
            val isTooFar = normArea < 0.07f

            // Tilt symmetry check
            val topW = hypot(normTL.x - normTR.x, normTL.y - normTR.y)
            val botW = hypot(normBL.x - normBR.x, normBL.y - normBR.y)
            val leftH = hypot(normTL.x - normBL.x, normTL.y - normBL.y)
            val rightH = hypot(normTR.x - normBR.x, normTR.y - normBR.y)
            val ratioW = max(topW, botW) / max(0.01f, min(topW, botW))
            val ratioH = max(leftH, rightH) / max(0.01f, min(leftH, rightH))
            val isTilted = ratioW > 1.70f || ratioH > 1.70f

            val confidence = (bestScore / 100.0).coerceIn(0.75, 0.99)

            return DetectionResult(
                tl = normTL,
                tr = normTR,
                br = normBR,
                bl = normBL,
                confidence = Math.round(confidence * 100.0) / 100.0,
                paperSize = bestPaperSize,
                aspectRatio = Math.round(bestAspectRatio * 100.0) / 100.0,
                isTilted = isTilted,
                isPartiallyVisible = isPartial,
                isTooFar = isTooFar,
                processingTimeMs = 0L
            )
        } catch (e: Exception) {
            Log.e(TAG, "Detection processing error:", e)
            return null
        } finally {
            resized?.release()
            blurred?.release()
            k3?.release()
            k5?.release()
            k9?.release()
        }
    }

    /**
     * Orders 4 vertices consistently: Top-Left, Top-Right, Bottom-Right, Bottom-Left
     * Uses clockwise polar angle sorting around the centroid, and sets Top-Left
     * as the vertex with minimum (x + y). Invariant to rotation and perspective tilt.
     */
    fun orderCorners(pts: Array<Point>): Array<Point> {
        if (pts.size != 4) return pts

        val cx = pts.map { it.x }.average()
        val cy = pts.map { it.y }.average()

        // Sort points in clockwise order around centroid
        val sorted = pts.sortedBy { p ->
            atan2(p.y - cy, p.x - cx)
        }

        // Find the top-left corner (smallest sum x + y)
        var minIdx = 0
        var minSum = sorted[0].x + sorted[0].y
        for (i in 1 until 4) {
            val s = sorted[i].x + sorted[i].y
            if (s < minSum) {
                minSum = s
                minIdx = i
            }
        }

        // Reorder so [0]=TL, [1]=TR, [2]=BR, [3]=BL in clockwise order
        return Array(4) { i -> sorted[(minIdx + i) % 4] }
    }

    /**
     * Multi-Factor Candidate Scoring Engine
     */
    private fun evaluateCandidate(
        pts: Array<Point>,
        targetW: Int,
        targetH: Int,
        areaRatio: Double,
        smoothMat: Mat,
        totalMeanLum: Double
    ): Double {
        var score = 0.0

        // Factor 1: Paper Interior Luminance & Contrast
        var mask: Mat? = null
        var dilatedMask: Mat? = null
        var ringMask: Mat? = null
        try {
            mask = Mat.zeros(Size(targetW.toDouble(), targetH.toDouble()), CvType.CV_8UC1)
            Imgproc.fillConvexPoly(mask, MatOfPoint(*pts), Scalar(255.0))

            val meanMat = MatOfDouble()
            val stdDevMat = MatOfDouble()
            Core.meanStdDev(smoothMat, meanMat, stdDevMat, mask)
            val insideMean = meanMat.toArray()[0]
            val insideStdDev = stdDevMat.toArray()[0]

            // A real document has high interior luminance (white paper)
            val lumScore = (insideMean / 255.0) * 35.0
            score += lumScore

            // Standard deviation penalty: true paper has uniform background, whereas
            // a contour that encompasses both white paper and black chair/desk has massive variance
            if (insideStdDev > 52.0) {
                score -= (insideStdDev - 52.0) * 0.8
            }

            // Contrast with immediate outer boundary (border step)
            dilatedMask = Mat()
            val kRing = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(9.0, 9.0))
            Imgproc.dilate(mask, dilatedMask, kRing)
            kRing.release()

            ringMask = Mat()
            Core.subtract(dilatedMask, mask, ringMask)
            val outsideMean = Core.mean(smoothMat, ringMask).`val`[0]
            val borderContrast = insideMean - outsideMean

            if (borderContrast >= 18.0) {
                score += min(25.0, borderContrast * 0.35)
            } else if (borderContrast < 4.0) {
                score -= 10.0
            }
        } catch (e: Exception) {
            score += 15.0
        } finally {
            mask?.release()
            dilatedMask?.release()
            ringMask?.release()
        }

        // Factor 2: Corner Orthogonality (Angles near 90°)
        var anglePenalty = 0.0
        for (i in 0 until 4) {
            val pPrev = pts[(i + 3) % 4]
            val pCurr = pts[i]
            val pNext = pts[(i + 1) % 4]

            val v1x = pPrev.x - pCurr.x
            val v1y = pPrev.y - pCurr.y
            val v2x = pNext.x - pCurr.x
            val v2y = pNext.y - pCurr.y

            val dot = v1x * v2x + v1y * v2y
            val mag = sqrt((v1x * v1x + v1y * v1y) * (v2x * v2x + v2y * v2y)).coerceAtLeast(1e-4)
            val cosTheta = abs(dot / mag)

            // cos(90) = 0. Penalize only if cosTheta > 0.50
            if (cosTheta > 0.50) {
                anglePenalty += (cosTheta - 0.50) * 20.0
            }
        }
        val angleScore = max(0.0, 25.0 - anglePenalty)
        score += angleScore

        // Factor 3: Perspective Symmetry
        val wTop = dist(pts[0], pts[1])
        val wBot = dist(pts[3], pts[2])
        val hLeft = dist(pts[0], pts[3])
        val hRight = dist(pts[1], pts[2])

        val ratioW = max(wTop, wBot) / max(1.0, min(wTop, wBot))
        val ratioH = max(hLeft, hRight) / max(1.0, min(hLeft, hRight))

        if (ratioW <= 1.40 && ratioH <= 1.40) {
            score += 22.0
        } else if (ratioW <= 1.65 && ratioH <= 1.65) {
            score += 15.0
        } else {
            score += 6.0
        }

        // Factor 4: Aspect Ratio Plausibility
        val avgW = (wTop + wBot) / 2.0
        val avgH = (hLeft + hRight) / 2.0
        val aspect = max(avgW, avgH) / max(1.0, min(avgW, avgH))

        if (aspect in 1.15..1.85) {
            score += 20.0
        } else if (aspect in 1.05..2.40) {
            score += 12.0
        }

        // Factor 5: Area Coverage Score (Ideal: 10% to 85% of view)
        score += when {
            areaRatio in 0.12..0.82 -> 18.0
            areaRatio in 0.07..0.90 -> 12.0
            else -> 6.0
        }

        return score
    }

    private fun dist(p1: Point, p2: Point): Double {
        val dx = p1.x - p2.x
        val dy = p1.y - p2.y
        return sqrt(dx * dx + dy * dy)
    }

    /**
     * Hardware-accelerated OpenCV 4-Point Perspective Transform & Crop
     * Restores accurate document geometry and removes all background (desks, laptops, cables).
     */
    fun warpPerspective(
        srcBitmap: Bitmap,
        corners: Array<Point>,
        paperPreset: String? = null
    ): Bitmap? {
        if (!isReady()) return null
        var srcMat: Mat? = null
        var dstMat: Mat? = null
        var transformMatrix: Mat? = null
        var srcPtMat: MatOfPoint2f? = null
        var dstPtMat: MatOfPoint2f? = null

        try {
            srcMat = Mat()
            Utils.bitmapToMat(srcBitmap, srcMat)

            val ordered = orderCorners(corners)
            val tl = ordered[0]
            val tr = ordered[1]
            val br = ordered[2]
            val bl = ordered[3]

            // Calculate true Euclidean dimensions of the four-point quad
            val widthTop = hypot(tr.x - tl.x, tr.y - tl.y)
            val widthBot = hypot(br.x - bl.x, br.y - bl.y)
            val heightLeft = hypot(bl.x - tl.x, bl.y - tl.y)
            val heightRight = hypot(br.x - tr.x, br.y - tr.y)

            var dstWidth = max(widthTop, widthBot).toInt().coerceAtLeast(200)
            var dstHeight = max(heightLeft, heightRight).toInt().coerceAtLeast(200)

            val isPortrait = dstHeight >= dstWidth

            // Restore standard paper aspect ratio if preset specified
            if (paperPreset != null && paperPreset.uppercase() != "CUSTOM") {
                val targetRatio = when (paperPreset.uppercase()) {
                    "A4", "A3", "A5" -> 1.4142
                    "LETTER" -> 1.2941
                    "ID" -> 1.5858
                    "LEGAL" -> 1.6470
                    else -> 0.0
                }
                if (targetRatio > 0.0) {
                    if (isPortrait) {
                        dstHeight = (dstWidth * targetRatio).toInt().coerceAtLeast(200)
                    } else {
                        dstWidth = (dstHeight * targetRatio).toInt().coerceAtLeast(200)
                    }
                }
            }

            srcPtMat = MatOfPoint2f(tl, tr, br, bl)
            dstPtMat = MatOfPoint2f(
                Point(0.0, 0.0),
                Point(dstWidth.toDouble(), 0.0),
                Point(dstWidth.toDouble(), dstHeight.toDouble()),
                Point(0.0, dstHeight.toDouble())
            )

            transformMatrix = Imgproc.getPerspectiveTransform(srcPtMat, dstPtMat)
            dstMat = Mat()
            Imgproc.warpPerspective(
                srcMat,
                dstMat,
                transformMatrix,
                Size(dstWidth.toDouble(), dstHeight.toDouble()),
                Imgproc.INTER_CUBIC
            )

            val outBitmap = Bitmap.createBitmap(dstWidth, dstHeight, Bitmap.Config.ARGB_8888)
            Utils.matToBitmap(dstMat, outBitmap)
            return outBitmap
        } catch (e: Exception) {
            Log.e(TAG, "Error in OpenCV warpPerspective", e)
            return null
        } finally {
            srcPtMat?.release()
            dstPtMat?.release()
            srcMat?.release()
            dstMat?.release()
            transformMatrix?.release()
        }
    }
}
