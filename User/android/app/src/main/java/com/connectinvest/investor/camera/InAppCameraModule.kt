package com.connectinvest.investor.camera

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class InAppCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        var activeCameraView: InAppCameraView? = null
    }

    override fun getName(): String = "InAppCameraModule"

    @ReactMethod
    fun isCameraAvailable(promise: Promise) {
        val hasHardware = reactApplicationContext.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
        val hasPerm = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(hasHardware && hasPerm)
    }

    @ReactMethod
    fun setTorch(enabled: Boolean, promise: Promise) {
        val view = activeCameraView
        if (view != null) {
            view.setTorch(enabled)
            promise.resolve(true)
        } else {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun capturePhoto(promise: Promise) {
        val view = activeCameraView
        if (view == null) {
            promise.reject("CAMERA_NOT_READY", "In-App Camera preview is not currently active.")
            return
        }

        val quad = view.currentDetectedQuad

        view.capturePhoto(
            onSuccess = { uri, width, height ->
                val map = Arguments.createMap()
                map.putString("uri", uri)
                map.putInt("width", width)
                map.putInt("height", height)

                if (quad != null) {
                    val cornersMap = Arguments.createMap().apply {
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
                    map.putMap("detectedCorners", cornersMap)
                    map.putString("paperSize", quad.paperSize)
                    map.putDouble("aspectRatio", quad.aspectRatio)
                    map.putDouble("confidence", quad.confidence)
                }
                promise.resolve(map)
            },
            onError = { errMsg ->
                promise.reject("CAPTURE_FAILED", errMsg)
            }
        )
    }

    /**
     * Decodes an image URI into a correctly oriented Bitmap
     */
    private fun loadOrientedBitmap(imageUri: String): Bitmap? {
        return try {
            val uri = Uri.parse(imageUri)
            val stream: InputStream? = if (uri.scheme == "file") {
                File(uri.path ?: "").inputStream()
            } else {
                reactApplicationContext.contentResolver.openInputStream(uri)
            }
            val bytes = stream?.readBytes() ?: return null
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null

            val orientation = try {
                if (uri.scheme == "file") {
                    val exif = ExifInterface(uri.path ?: "")
                    exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                } else {
                    val exifStream = bytes.inputStream()
                    val exif = ExifInterface(exifStream)
                    exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                }
            } catch (e: Exception) {
                ExifInterface.ORIENTATION_NORMAL
            }

            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            }

            if (!matrix.isIdentity) {
                Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            } else {
                bitmap
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Document Edge Detection Algorithm
     * Scans for high-contrast paper boundaries against darker surfaces.
     */
    private fun detectDocumentBounds(bitmap: Bitmap): Rect {
        val origW = bitmap.width
        val origH = bitmap.height

        val targetW = 400
        val targetH = (origH * (targetW.toFloat() / origW)).toInt().coerceAtLeast(100)
        val scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, false)

        val pixels = IntArray(targetW * targetH)
        scaled.getPixels(pixels, 0, targetW, 0, 0, targetW, targetH)

        val lum = FloatArray(targetW * targetH)
        for (i in pixels.indices) {
            val c = pixels[i]
            val r = (c shr 16) and 0xFF
            val g = (c shr 8) and 0xFF
            val b = c and 0xFF
            lum[i] = 0.299f * r + 0.587f * g + 0.114f * b
        }

        // Default bounds: 4% margin inset
        val minX = (targetW * 0.04f).toInt()
        val maxX = (targetW * 0.96f).toInt()
        val minY = (targetH * 0.04f).toInt()
        val maxY = (targetH * 0.96f).toInt()

        val checkRows = listOf(
            (targetH * 0.30f).toInt(),
            (targetH * 0.40f).toInt(),
            (targetH * 0.50f).toInt(),
            (targetH * 0.60f).toInt(),
            (targetH * 0.70f).toInt()
        )

        val edgeThreshold = 24.0f
        var detectedLeft = minX
        for (x in 2 until targetW / 3) {
            var gradSum = 0f
            for (y in checkRows) {
                val idx = y * targetW + x
                val prevIdx = y * targetW + (x - 2)
                gradSum += (lum[idx] - lum[prevIdx])
            }
            if (gradSum / checkRows.size > edgeThreshold) {
                detectedLeft = x
                break
            }
        }

        var detectedRight = maxX
        for (x in (targetW - 3) downTo (targetW * 2 / 3)) {
            var gradSum = 0f
            for (y in checkRows) {
                val idx = y * targetW + x
                val nextIdx = y * targetW + (x + 2)
                gradSum += (lum[idx] - lum[nextIdx])
            }
            if (gradSum / checkRows.size > edgeThreshold) {
                detectedRight = x
                break
            }
        }

        val checkCols = listOf(
            (targetW * 0.30f).toInt(),
            (targetW * 0.40f).toInt(),
            (targetW * 0.50f).toInt(),
            (targetW * 0.60f).toInt(),
            (targetW * 0.70f).toInt()
        )
        var detectedTop = minY
        for (y in 2 until targetH / 3) {
            var gradSum = 0f
            for (x in checkCols) {
                val idx = y * targetW + x
                val prevIdx = (y - 2) * targetW + x
                gradSum += (lum[idx] - lum[prevIdx])
            }
            if (gradSum / checkCols.size > edgeThreshold) {
                detectedTop = y
                break
            }
        }

        var detectedBottom = maxY
        for (y in (targetH - 3) downTo (targetH * 2 / 3)) {
            var gradSum = 0f
            for (x in checkCols) {
                val idx = y * targetW + x
                val nextIdx = (y + 2) * targetW + x
                gradSum += (lum[idx] - lum[nextIdx])
            }
            if (gradSum / checkCols.size > edgeThreshold) {
                detectedBottom = y
                break
            }
        }

        val scaleX = origW.toFloat() / targetW
        val scaleY = origH.toFloat() / targetH

        val finalLeft = (detectedLeft * scaleX).toInt().coerceIn(0, origW - 20)
        val finalRight = (detectedRight * scaleX).toInt().coerceIn(finalLeft + 20, origW)
        val finalTop = (detectedTop * scaleY).toInt().coerceIn(0, origH - 20)
        val finalBottom = (detectedBottom * scaleY).toInt().coerceIn(finalTop + 20, origH)

        return Rect(finalLeft, finalTop, finalRight, finalBottom)
    }

    data class PaperAnalysis(
        val paperSize: String,
        val paperName: String,
        val dimensions: String,
        val aspectRatio: Double,
        val confidence: Double,
        val isIsoSeries: Boolean,
        val suggestedSizes: List<String>
    )

    /**
     * Analyzes detected document aspect ratio against international paper standards
     * - A4: 210 x 297 mm (ratio 1 : 1.414)
     * - A3: 297 x 420 mm (ratio 1 : 1.414)
     * - A5: 148 x 210 mm (ratio 1 : 1.414)
     * - Letter: 216 x 279 mm (ratio 1 : 1.294)
     * - ID Card: 85.6 x 54 mm (ratio 1 : 1.586)
     */
    private fun analyzePaperSize(width: Int, height: Int): PaperAnalysis {
        val longSide = max(width, height).toDouble()
        val shortSide = min(width, height).toDouble().coerceAtLeast(1.0)
        val ratio = longSide / shortSide

        val isoRatio = 1.4142
        val isoDelta = abs(ratio - isoRatio)

        val letterRatio = 1.2941
        val letterDelta = abs(ratio - letterRatio)

        val idRatio = 1.5858
        val idDelta = abs(ratio - idRatio)

        val legalRatio = 1.647
        val legalDelta = abs(ratio - legalRatio)

        return when {
            isoDelta <= 0.12 -> {
                val confidence = (1.0 - (isoDelta / 0.12) * 0.15).coerceIn(0.85, 0.99)
                PaperAnalysis(
                    paperSize = "A4",
                    paperName = "A4 Document",
                    dimensions = "210 × 297 mm",
                    aspectRatio = Math.round(ratio * 100.0) / 100.0,
                    confidence = Math.round(confidence * 100.0) / 100.0,
                    isIsoSeries = true,
                    suggestedSizes = listOf("A4", "A3", "A5")
                )
            }
            letterDelta <= 0.08 -> {
                val confidence = (1.0 - (letterDelta / 0.08) * 0.15).coerceIn(0.85, 0.98)
                PaperAnalysis(
                    paperSize = "Letter",
                    paperName = "US Letter",
                    dimensions = "215.9 × 279.4 mm (8.5 × 11 in)",
                    aspectRatio = Math.round(ratio * 100.0) / 100.0,
                    confidence = Math.round(confidence * 100.0) / 100.0,
                    isIsoSeries = false,
                    suggestedSizes = listOf("Letter", "A4")
                )
            }
            idDelta <= 0.10 -> {
                val confidence = (1.0 - (idDelta / 0.10) * 0.15).coerceIn(0.85, 0.98)
                PaperAnalysis(
                    paperSize = "ID",
                    paperName = "ID Card / Driver License",
                    dimensions = "85.6 × 54.0 mm",
                    aspectRatio = Math.round(ratio * 100.0) / 100.0,
                    confidence = Math.round(confidence * 100.0) / 100.0,
                    isIsoSeries = false,
                    suggestedSizes = listOf("ID", "Custom")
                )
            }
            legalDelta <= 0.09 -> {
                val confidence = (1.0 - (legalDelta / 0.09) * 0.15).coerceIn(0.85, 0.95)
                PaperAnalysis(
                    paperSize = "Legal",
                    paperName = "US Legal",
                    dimensions = "215.9 × 355.6 mm",
                    aspectRatio = Math.round(ratio * 100.0) / 100.0,
                    confidence = Math.round(confidence * 100.0) / 100.0,
                    isIsoSeries = false,
                    suggestedSizes = listOf("Legal", "A4")
                )
            }
            else -> {
                if (ratio in 1.1..1.7) {
                    PaperAnalysis(
                        paperSize = "A4",
                        paperName = "A4 Document",
                        dimensions = "210 × 297 mm",
                        aspectRatio = Math.round(ratio * 100.0) / 100.0,
                        confidence = 0.88,
                        isIsoSeries = true,
                        suggestedSizes = listOf("A4", "A3", "A5")
                    )
                } else {
                    PaperAnalysis(
                        paperSize = "Custom",
                        paperName = "Custom Document",
                        dimensions = "${width} × ${height} px",
                        aspectRatio = Math.round(ratio * 100.0) / 100.0,
                        confidence = 0.80,
                        isIsoSeries = false,
                        suggestedSizes = listOf("Custom", "A4")
                    )
                }
            }
        }
    }

    private fun saveCroppedBitmap(bitmap: Bitmap, rect: Rect): Pair<String, Pair<Int, Int>> {
        val safeLeft = rect.left.coerceIn(0, bitmap.width - 10)
        val safeTop = rect.top.coerceIn(0, bitmap.height - 10)
        val safeWidth = rect.width().coerceIn(10, bitmap.width - safeLeft)
        val safeHeight = rect.height().coerceIn(10, bitmap.height - safeTop)

        val cropped = Bitmap.createBitmap(bitmap, safeLeft, safeTop, safeWidth, safeHeight)

        val cacheDir = reactApplicationContext.cacheDir
        val outFile = File(cacheDir, "FIC_CROP_${System.currentTimeMillis()}.jpg")
        val fos = FileOutputStream(outFile)
        cropped.compress(Bitmap.CompressFormat.JPEG, 95, fos)
        fos.flush()
        fos.close()

        return Pair(Uri.fromFile(outFile).toString(), Pair(safeWidth, safeHeight))
    }

    /**
     * Auto Detects Document Edges, Auto-Crops, and Analyzes Paper Size (A4, A3, A5, etc.)
     */
    @ReactMethod
    fun analyzeAndCropDocument(imageUri: String, promise: Promise) {
        Thread {
            try {
                val bitmap = loadOrientedBitmap(imageUri)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode image from URI: $imageUri")
                    return@Thread
                }

                // 1. Detect Document Boundaries
                val bounds = detectDocumentBounds(bitmap)

                // 2. Analyze Paper Size (A4, A3, A5, Letter, ID, etc.)
                val analysis = analyzePaperSize(bounds.width(), bounds.height())

                // 3. Auto Crop Bitmap
                val (croppedUri, dims) = saveCroppedBitmap(bitmap, bounds)

                // 4. Return complete result
                val result = Arguments.createMap()
                result.putString("originalUri", imageUri)
                result.putString("croppedUri", croppedUri)
                result.putInt("originalWidth", bitmap.width)
                result.putInt("originalHeight", bitmap.height)
                result.putInt("croppedWidth", dims.first)
                result.putInt("croppedHeight", dims.second)

                result.putString("paperSize", analysis.paperSize) // "A4", "A3", "A5", "Letter", "ID"
                result.putString("paperName", analysis.paperName)
                result.putString("paperDimensions", analysis.dimensions)
                result.putDouble("aspectRatio", analysis.aspectRatio)
                result.putDouble("confidence", analysis.confidence)
                result.putBoolean("isIsoSeries", analysis.isIsoSeries)

                val suggestedArray = Arguments.createArray()
                analysis.suggestedSizes.forEach { suggestedArray.pushString(it) }
                result.putArray("suggestedSizes", suggestedArray)

                val cropBox = Arguments.createMap()
                cropBox.putDouble("left", bounds.left.toDouble() / bitmap.width)
                cropBox.putDouble("top", bounds.top.toDouble() / bitmap.height)
                cropBox.putDouble("right", bounds.right.toDouble() / bitmap.width)
                cropBox.putDouble("bottom", bounds.bottom.toDouble() / bitmap.height)
                result.putMap("normalizedBounds", cropBox)

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ANALYSIS_ERROR", e.message ?: "Failed to analyze and crop image")
            }
        }.start()
    }

    /**
     * Warps perspective and crops document using 4 detected corner coordinates
     */
    @ReactMethod
    fun warpPerspectiveAndCrop(
        imageUri: String,
        corners: ReadableMap,
        paperPreset: String?,
        promise: Promise
    ) {
        Thread {
            try {
                val bitmap = loadOrientedBitmap(imageUri)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode image from URI: $imageUri")
                    return@Thread
                }

                val origW = bitmap.width
                val origH = bitmap.height

                val tl = corners.getMap("tl")
                val tr = corners.getMap("tr")
                val br = corners.getMap("br")
                val bl = corners.getMap("bl")

                val tlX = (tl?.getDouble("x")?.toFloat() ?: 0.05f).coerceIn(0f, 1f) * origW
                val tlY = (tl?.getDouble("y")?.toFloat() ?: 0.05f).coerceIn(0f, 1f) * origH
                val trX = (tr?.getDouble("x")?.toFloat() ?: 0.95f).coerceIn(0f, 1f) * origW
                val trY = (tr?.getDouble("y")?.toFloat() ?: 0.05f).coerceIn(0f, 1f) * origH
                val brX = (br?.getDouble("x")?.toFloat() ?: 0.95f).coerceIn(0f, 1f) * origW
                val brY = (br?.getDouble("y")?.toFloat() ?: 0.95f).coerceIn(0f, 1f) * origH
                val blX = (bl?.getDouble("x")?.toFloat() ?: 0.05f).coerceIn(0f, 1f) * origW
                val blY = (bl?.getDouble("y")?.toFloat() ?: 0.05f).coerceIn(0f, 1f) * origH

                val src = floatArrayOf(
                    tlX, tlY,
                    trX, trY,
                    brX, brY,
                    blX, blY
                )

                val widthTop = hypot((trX - tlX).toDouble(), (trY - tlY).toDouble()).toFloat()
                val widthBot = hypot((brX - blX).toDouble(), (brY - blY).toDouble()).toFloat()
                val heightLeft = hypot((blX - tlX).toDouble(), (blY - tlY).toDouble()).toFloat()
                val heightRight = hypot((brX - trX).toDouble(), (brY - trY).toDouble()).toFloat()

                val avgW = ((widthTop + widthBot) / 2f).toInt().coerceIn(100, origW)
                val avgH = ((heightLeft + heightRight) / 2f).toInt().coerceIn(100, origH)

                val isPortrait = avgH >= avgW
                val targetRatio = when (paperPreset?.uppercase()) {
                    "A4", "A3", "A5" -> 1.4142f
                    "LETTER" -> 1.2941f
                    "ID" -> 1.5858f
                    "LEGAL" -> 1.647f
                    else -> (max(avgW, avgH).toFloat() / min(avgW, avgH).coerceAtLeast(1).toFloat())
                }

                val outW: Int
                val outH: Int
                if (isPortrait) {
                    outW = avgW
                    outH = (avgW * targetRatio).toInt().coerceAtLeast(100)
                } else {
                    outH = avgH
                    outW = (avgH * targetRatio).toInt().coerceAtLeast(100)
                }

                val dst = floatArrayOf(
                    0f, 0f,
                    outW.toFloat(), 0f,
                    outW.toFloat(), outH.toFloat(),
                    0f, outH.toFloat()
                )

                // Use hardware OpenCV projective warpPerspective if ready, falling back to setPolyToPoly
                val warpedBitmap: Bitmap = if (DocumentDetectorOpenCV.isReady()) {
                    val cvPts = arrayOf(
                        org.opencv.core.Point(tlX.toDouble(), tlY.toDouble()),
                        org.opencv.core.Point(trX.toDouble(), trY.toDouble()),
                        org.opencv.core.Point(brX.toDouble(), brY.toDouble()),
                        org.opencv.core.Point(blX.toDouble(), blY.toDouble())
                    )
                    DocumentDetectorOpenCV.warpPerspective(bitmap, cvPts) ?: run {
                        val matrix = Matrix()
                        matrix.setPolyToPoly(src, 0, dst, 0, 4)
                        val fallback = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(fallback)
                        canvas.drawColor(Color.WHITE)
                        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                        canvas.drawBitmap(bitmap, matrix, paint)
                        fallback
                    }
                } else {
                    val matrix = Matrix()
                    matrix.setPolyToPoly(src, 0, dst, 0, 4)
                    val fallback = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(fallback)
                    canvas.drawColor(Color.WHITE)
                    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                    canvas.drawBitmap(bitmap, matrix, paint)
                    fallback
                }

                val outFile = File(reactApplicationContext.cacheDir, "FIC_WARP_${System.currentTimeMillis()}.jpg")
                val fos = FileOutputStream(outFile)
                warpedBitmap.compress(Bitmap.CompressFormat.JPEG, 95, fos)
                fos.flush()
                fos.close()

                val analysis = analyzePaperSize(outW, outH)

                val result = Arguments.createMap().apply {
                    putString("originalUri", imageUri)
                    putString("croppedUri", Uri.fromFile(outFile).toString())
                    putInt("originalWidth", origW)
                    putInt("originalHeight", origH)
                    putInt("croppedWidth", outW)
                    putInt("croppedHeight", outH)
                    putString("paperSize", paperPreset ?: analysis.paperSize)
                    putString("paperName", analysis.paperName)
                    putString("paperDimensions", analysis.dimensions)
                    putDouble("aspectRatio", analysis.aspectRatio)
                    putDouble("confidence", analysis.confidence)
                    putBoolean("isIsoSeries", analysis.isIsoSeries)

                    val suggestedArray = Arguments.createArray()
                    analysis.suggestedSizes.forEach { suggestedArray.pushString(it) }
                    putArray("suggestedSizes", suggestedArray)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("WARP_ERROR", e.message ?: "Failed to warp and crop document")
            }
        }.start()
    }

    /**
     * Crop image with specific paper preset or custom rectangle
     */
    @ReactMethod
    fun cropWithPreset(imageUri: String, preset: String, customBox: ReadableMap?, promise: Promise) {
        Thread {
            try {
                val bitmap = loadOrientedBitmap(imageUri)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode image: $imageUri")
                    return@Thread
                }

                val origW = bitmap.width
                val origH = bitmap.height

                val rect = if (customBox != null && customBox.hasKey("left") && customBox.hasKey("right")) {
                    val l = (customBox.getDouble("left") * origW).toInt().coerceIn(0, origW - 10)
                    val t = (customBox.getDouble("top") * origH).toInt().coerceIn(0, origH - 10)
                    val r = (customBox.getDouble("right") * origW).toInt().coerceIn(l + 10, origW)
                    val b = (customBox.getDouble("bottom") * origH).toInt().coerceIn(t + 10, origH)
                    Rect(l, t, r, b)
                } else {
                    // Calculate target aspect ratio based on preset
                    val targetRatio = when (preset.uppercase()) {
                        "A4", "A3", "A5" -> 1.4142
                        "LETTER" -> 1.2941
                        "ID" -> 1.5858
                        "LEGAL" -> 1.647
                        else -> origH.toDouble() / origW.toDouble()
                    }

                    val isPortrait = origH >= origW
                    if (isPortrait) {
                        val idealW = (origH / targetRatio).toInt().coerceAtMost(origW)
                        val xOffset = (origW - idealW) / 2
                        Rect(xOffset, 0, xOffset + idealW, origH)
                    } else {
                        val idealH = (origW / targetRatio).toInt().coerceAtMost(origH)
                        val yOffset = (origH - idealH) / 2
                        Rect(0, yOffset, origW, yOffset + idealH)
                    }
                }

                val (croppedUri, dims) = saveCroppedBitmap(bitmap, rect)
                val analysis = analyzePaperSize(dims.first, dims.second)

                val result = Arguments.createMap()
                result.putString("croppedUri", croppedUri)
                result.putInt("croppedWidth", dims.first)
                result.putInt("croppedHeight", dims.second)
                result.putString("paperSize", preset.ifEmpty { analysis.paperSize })
                result.putString("paperName", analysis.paperName)
                result.putString("paperDimensions", analysis.dimensions)
                result.putDouble("aspectRatio", analysis.aspectRatio)

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("CROP_ERROR", e.message ?: "Failed to crop image")
            }
        }.start()
    }

    /**
     * Saves raw base64 data to a file in the app cache directory and returns a file URI
     * Parameter count: 3 arguments from JS (base64Data, fileName, mimeType) + Promise (2 callbacks) = 5 bridge args
     */
    @ReactMethod
    fun saveBase64ToFile(base64Data: String, fileName: String, mimeType: String, promise: Promise) {
        saveBase64ToFileInternal(base64Data, fileName, if (mimeType.isEmpty()) "application/pdf" else mimeType, promise)
    }

    @ReactMethod
    fun saveBase64ToFileSimple(base64Data: String, fileName: String, promise: Promise) {
        saveBase64ToFileInternal(base64Data, fileName, "application/pdf", promise)
    }

    private fun saveBase64ToFileInternal(base64Data: String, fileName: String, mimeType: String, promise: Promise) {
        Thread {
            try {
                val cleanBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }
                val bytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT)
                val cacheDir = reactApplicationContext.cacheDir
                val outFile = File(cacheDir, fileName)
                FileOutputStream(outFile).use { it.write(bytes) }

                promise.resolve(Uri.fromFile(outFile).toString())
            } catch (e: Exception) {
                promise.reject("SAVE_FAILED", e.message ?: "Failed to save file")
            }
        }.start()
    }

    /**
     * Shares a document file (PDF, Image, etc.) directly through Android's native share sheet
     */
    @ReactMethod
    fun shareFile(fileUri: String, mimeType: String, title: String, promise: Promise) {
        try {
            val uri = Uri.parse(fileUri)
            val file = if (uri.scheme == "file") {
                File(uri.path ?: "")
            } else {
                File(fileUri)
            }

            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: $fileUri")
                return
            }

            val contentUri: Uri = androidx.core.content.FileProvider.getUriForFile(
                reactApplicationContext,
                "${reactApplicationContext.packageName}.provider",
                file
            )

            val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = if (mimeType.isNotEmpty()) mimeType else "application/pdf"
                putExtra(android.content.Intent.EXTRA_STREAM, contentUri)
                putExtra(android.content.Intent.EXTRA_SUBJECT, title)
                putExtra(android.content.Intent.EXTRA_TEXT, "Sharing \"$title\" from FIC Locker.")
                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = android.content.Intent.createChooser(shareIntent, "Share $title").apply {
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_FAILED", e.message ?: "Failed to share file")
        }
    }
}
