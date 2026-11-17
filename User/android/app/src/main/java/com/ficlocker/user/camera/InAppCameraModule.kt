package com.ficlocker.user.camera

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.media.ExifInterface
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class InAppCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pickDocumentPromise: Promise? = null
    private val PICK_DOCUMENT_REQUEST = 9182

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == PICK_DOCUMENT_REQUEST) {
            val promise = pickDocumentPromise ?: return
            pickDocumentPromise = null

            if (resultCode == Activity.RESULT_OK && data != null && data.data != null) {
                val uri = data.data!!
                try {
                    var fileName = "Document_${System.currentTimeMillis()}"
                    var fileSize = 0L

                    val cursor = reactApplicationContext.contentResolver.query(uri, null, null, null, null)
                    cursor?.use {
                        if (it.moveToFirst()) {
                            val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                            val sizeIndex = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
                            if (nameIndex != -1) fileName = it.getString(nameIndex) ?: fileName
                            if (sizeIndex != -1) fileSize = it.getLong(sizeIndex)
                        }
                    }

                    val cachedFile = File(reactApplicationContext.cacheDir, fileName)
                    reactApplicationContext.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(cachedFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    if (fileSize == 0L) fileSize = cachedFile.length()

                    val result = Arguments.createMap().apply {
                        putString("uri", Uri.fromFile(cachedFile).toString())
                        putString("name", fileName)
                        putDouble("size", fileSize.toDouble())
                        putString("type", reactApplicationContext.contentResolver.getType(uri) ?: "")
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("FILE_READ_ERROR", e.message ?: "Failed to read picked file")
                }
            } else {
                promise.resolve(null)
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {}

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

        val sensorQuad = view.currentSensorQuad
        val viewQuad = view.currentDetectedQuad
        val quad = sensorQuad

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

                if (viewQuad != null) {
                    val viewMap = Arguments.createMap().apply {
                        putMap("tl", Arguments.createMap().apply {
                            putDouble("x", viewQuad.tl.x.toDouble())
                            putDouble("y", viewQuad.tl.y.toDouble())
                        })
                        putMap("tr", Arguments.createMap().apply {
                            putDouble("x", viewQuad.tr.x.toDouble())
                            putDouble("y", viewQuad.tr.y.toDouble())
                        })
                        putMap("br", Arguments.createMap().apply {
                            putDouble("x", viewQuad.br.x.toDouble())
                            putDouble("y", viewQuad.br.y.toDouble())
                        })
                        putMap("bl", Arguments.createMap().apply {
                            putDouble("x", viewQuad.bl.x.toDouble())
                            putDouble("y", viewQuad.bl.y.toDouble())
                        })
                    }
                    map.putMap("viewCorners", viewMap)
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
            val stream: InputStream? = try {
                when (uri.scheme) {
                    "http", "https" -> java.net.URL(imageUri).openStream()
                    "content" -> {
                        try {
                            reactApplicationContext.contentResolver.openInputStream(uri)
                        } catch (e: Exception) {
                            currentActivity?.contentResolver?.openInputStream(uri)
                        }
                    }
                    "file" -> {
                        val path = uri.path ?: ""
                        val f = File(path)
                        if (f.exists()) {
                            f.inputStream()
                        } else {
                            try {
                                reactApplicationContext.contentResolver.openInputStream(uri)
                            } catch (e: Exception) {
                                val decoded = Uri.decode(path)
                                val fDecoded = File(decoded)
                                if (fDecoded.exists()) fDecoded.inputStream() else null
                            }
                        }
                    }
                    else -> {
                        val f = File(imageUri)
                        if (f.exists()) f.inputStream() else {
                            try {
                                reactApplicationContext.contentResolver.openInputStream(uri)
                            } catch (e: Exception) { null }
                        }
                    }
                }
            } catch (e: Exception) {
                null
            }

            val bytes = stream?.use { it.readBytes() } ?: return null
            if (bytes.isEmpty()) return null

            // Safe memory decode with inSampleSize
            val boundsOptions = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, boundsOptions)

            var sampleSize = 1
            val maxDim = Math.max(boundsOptions.outWidth, boundsOptions.outHeight)
            while (maxDim / sampleSize > 2500) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions) ?: return null

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
        } catch (t: Throwable) {
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
     * Detects document corners directly on an image using OpenCV
     */
    @ReactMethod
    fun detectDocumentOnImage(imageUri: String, promise: Promise) {
        Thread {
            try {
                val bitmap = loadOrientedBitmap(imageUri)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode image from URI: $imageUri")
                    return@Thread
                }

                val cvResult = if (DocumentDetectorOpenCV.isReady()) {
                    DocumentDetectorOpenCV.detectDocumentBitmap(bitmap)
                } else null

                val result = Arguments.createMap()
                result.putInt("imageWidth", bitmap.width)
                result.putInt("imageHeight", bitmap.height)

                if (cvResult != null) {
                    result.putBoolean("detected", true)
                    result.putString("paperSize", cvResult.paperSize)
                    result.putDouble("aspectRatio", cvResult.aspectRatio)
                    result.putDouble("confidence", cvResult.confidence)

                    val cornersMap = Arguments.createMap().apply {
                        putMap("tl", Arguments.createMap().apply {
                            putDouble("x", cvResult.tl.x.toDouble())
                            putDouble("y", cvResult.tl.y.toDouble())
                        })
                        putMap("tr", Arguments.createMap().apply {
                            putDouble("x", cvResult.tr.x.toDouble())
                            putDouble("y", cvResult.tr.y.toDouble())
                        })
                        putMap("br", Arguments.createMap().apply {
                            putDouble("x", cvResult.br.x.toDouble())
                            putDouble("y", cvResult.br.y.toDouble())
                        })
                        putMap("bl", Arguments.createMap().apply {
                            putDouble("x", cvResult.bl.x.toDouble())
                            putDouble("y", cvResult.bl.y.toDouble())
                        })
                    }
                    result.putMap("corners", cornersMap)
                } else {
                    result.putBoolean("detected", false)
                    // Centered 5% margin fallback corners
                    val defaultMap = Arguments.createMap().apply {
                        putMap("tl", Arguments.createMap().apply { putDouble("x", 0.05); putDouble("y", 0.05) })
                        putMap("tr", Arguments.createMap().apply { putDouble("x", 0.95); putDouble("y", 0.05) })
                        putMap("br", Arguments.createMap().apply { putDouble("x", 0.95); putDouble("y", 0.95) })
                        putMap("bl", Arguments.createMap().apply { putDouble("x", 0.05); putDouble("y", 0.95) })
                    }
                    result.putMap("corners", defaultMap)
                    result.putString("paperSize", "A4")
                    result.putDouble("aspectRatio", 1.414)
                    result.putDouble("confidence", 0.70)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("DETECT_ERROR", e.message ?: "Failed to detect document on image")
            }
        }.start()
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

                val origW = bitmap.width
                val origH = bitmap.height

                // 1. Detect Document Boundaries with OpenCV
                val cvResult = if (DocumentDetectorOpenCV.isReady()) {
                    DocumentDetectorOpenCV.detectDocumentBitmap(bitmap)
                } else null

                if (cvResult != null) {
                    val cvPts = arrayOf(
                        org.opencv.core.Point(cvResult.tl.x.toDouble() * origW, cvResult.tl.y.toDouble() * origH),
                        org.opencv.core.Point(cvResult.tr.x.toDouble() * origW, cvResult.tr.y.toDouble() * origH),
                        org.opencv.core.Point(cvResult.br.x.toDouble() * origW, cvResult.br.y.toDouble() * origH),
                        org.opencv.core.Point(cvResult.bl.x.toDouble() * origW, cvResult.bl.y.toDouble() * origH)
                    )
                    val warped = DocumentDetectorOpenCV.warpPerspective(bitmap, cvPts, cvResult.paperSize) ?: bitmap
                    val outFile = File(reactApplicationContext.cacheDir, "FIC_WARP_${System.currentTimeMillis()}.jpg")
                    val fos = FileOutputStream(outFile)
                    warped.compress(Bitmap.CompressFormat.JPEG, 95, fos)
                    fos.flush()
                    fos.close()

                    val analysis = analyzePaperSize(warped.width, warped.height)
                    val result = Arguments.createMap().apply {
                        putString("originalUri", imageUri)
                        putString("croppedUri", Uri.fromFile(outFile).toString())
                        putInt("originalWidth", origW)
                        putInt("originalHeight", origH)
                        putInt("croppedWidth", warped.width)
                        putInt("croppedHeight", warped.height)
                        putString("paperSize", cvResult.paperSize)
                        putString("paperName", analysis.paperName)
                        putString("paperDimensions", analysis.dimensions)
                        putDouble("aspectRatio", cvResult.aspectRatio)
                        putDouble("confidence", cvResult.confidence)
                        putBoolean("isIsoSeries", analysis.isIsoSeries)

                        val cornersMap = Arguments.createMap().apply {
                            putMap("tl", Arguments.createMap().apply {
                                putDouble("x", cvResult.tl.x.toDouble())
                                putDouble("y", cvResult.tl.y.toDouble())
                            })
                            putMap("tr", Arguments.createMap().apply {
                                putDouble("x", cvResult.tr.x.toDouble())
                                putDouble("y", cvResult.tr.y.toDouble())
                            })
                            putMap("br", Arguments.createMap().apply {
                                putDouble("x", cvResult.br.x.toDouble())
                                putDouble("y", cvResult.br.y.toDouble())
                            })
                            putMap("bl", Arguments.createMap().apply {
                                putDouble("x", cvResult.bl.x.toDouble())
                                putDouble("y", cvResult.bl.y.toDouble())
                            })
                        }
                        putMap("detectedCorners", cornersMap)

                        val cropBox = Arguments.createMap().apply {
                            putDouble("left", min(cvResult.tl.x, cvResult.bl.x).toDouble())
                            putDouble("top", min(cvResult.tl.y, cvResult.tr.y).toDouble())
                            putDouble("right", max(cvResult.tr.x, cvResult.br.x).toDouble())
                            putDouble("bottom", max(cvResult.bl.y, cvResult.br.y).toDouble())
                        }
                        putMap("normalizedBounds", cropBox)

                        val suggestedArray = Arguments.createArray()
                        analysis.suggestedSizes.forEach { suggestedArray.pushString(it) }
                        putArray("suggestedSizes", suggestedArray)
                    }
                    promise.resolve(result)
                    return@Thread
                }

                // Fallback to bounding rectangle
                val bounds = detectDocumentBounds(bitmap)
                val analysis = analyzePaperSize(bounds.width(), bounds.height())
                val (croppedUri, dims) = saveCroppedBitmap(bitmap, bounds)

                val result = Arguments.createMap()
                result.putString("originalUri", imageUri)
                result.putString("croppedUri", croppedUri)
                result.putInt("originalWidth", bitmap.width)
                result.putInt("originalHeight", bitmap.height)
                result.putInt("croppedWidth", dims.first)
                result.putInt("croppedHeight", dims.second)

                result.putString("paperSize", analysis.paperSize)
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
                    DocumentDetectorOpenCV.warpPerspective(bitmap, cvPts, paperPreset) ?: run {
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
     * Shares a document file (PDF, Image, etc.) directly through Android's native share sheet as a real attachment
     */
    @ReactMethod
    fun shareFile(fileUri: String, mimeType: String, title: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(fileUri)
                val file: File = when (uri.scheme) {
                    "file" -> File(uri.path ?: "")
                    "content" -> {
                        val ext = if (mimeType.contains("pdf", ignoreCase = true) || title.endsWith(".pdf", ignoreCase = true)) "pdf" else "jpg"
                        val cached = File(reactApplicationContext.cacheDir, "shared_${System.currentTimeMillis()}.$ext")
                        reactApplicationContext.contentResolver.openInputStream(uri)?.use { input ->
                            FileOutputStream(cached).use { output -> input.copyTo(output) }
                        }
                        cached
                    }
                    "http", "https" -> {
                        val ext = if (mimeType.contains("pdf", ignoreCase = true) || title.endsWith(".pdf", ignoreCase = true)) "pdf" else "jpg"
                        val cached = File(reactApplicationContext.cacheDir, "shared_${System.currentTimeMillis()}.$ext")
                        java.net.URL(fileUri).openStream().use { input ->
                            FileOutputStream(cached).use { output -> input.copyTo(output) }
                        }
                        cached
                    }
                    else -> {
                        val f = File(fileUri)
                        if (f.exists()) f else File(uri.path ?: fileUri)
                    }
                }

                if (!file.exists() || file.length() == 0L) {
                    promise.reject("FILE_NOT_FOUND", "File does not exist: $fileUri")
                    return@Thread
                }

                val contentUri: Uri = androidx.core.content.FileProvider.getUriForFile(
                    reactApplicationContext,
                    "${reactApplicationContext.packageName}.provider",
                    file
                )

                val effectiveMime = if (mimeType.isNotEmpty()) mimeType else {
                    if (file.name.endsWith(".pdf", ignoreCase = true) || title.endsWith(".pdf", ignoreCase = true)) {
                        "application/pdf"
                    } else {
                        "image/jpeg"
                    }
                }

                val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                    type = effectiveMime
                    putExtra(android.content.Intent.EXTRA_STREAM, contentUri)
                    putExtra(android.content.Intent.EXTRA_SUBJECT, title)
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
        }.start()
    }

    /**
     * Saves an image file directly into the device's external Pictures / Gallery directory
     */
    @ReactMethod
    fun saveImageToGallery(imageUri: String, fileName: String, promise: Promise) {
        Thread {
            try {
                val bitmap = loadOrientedBitmap(imageUri)
                if (bitmap == null) {
                    promise.reject("LOAD_FAILED", "Could not load image to save to gallery")
                    return@Thread
                }

                val cleanName = if (fileName.isNotEmpty()) fileName.replace(".pdf", "") else "FIC_DOC_${System.currentTimeMillis()}"
                val displayName = "$cleanName.jpg"
                val resolver = reactApplicationContext.contentResolver

                val contentValues = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, displayName)
                    put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                        put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES + "/FIC_Locker")
                        put(android.provider.MediaStore.Images.Media.IS_PENDING, 1)
                    }
                }

                val imageCollection = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    android.provider.MediaStore.Images.Media.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
                } else {
                    android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                }

                val uri = resolver.insert(imageCollection, contentValues)
                if (uri == null) {
                    promise.reject("INSERT_FAILED", "Failed to create gallery entry")
                    return@Thread
                }

                val outputStream = resolver.openOutputStream(uri)
                if (outputStream == null) {
                    promise.reject("STREAM_FAILED", "Failed to open output stream")
                    return@Thread
                }

                bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outputStream)
                outputStream.flush()
                outputStream.close()

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    contentValues.clear()
                    contentValues.put(android.provider.MediaStore.Images.Media.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)
                } else {
                    android.media.MediaScannerConnection.scanFile(
                        reactApplicationContext,
                        arrayOf(uri.path),
                        arrayOf("image/jpeg"),
                        null
                    )
                }

                promise.resolve(uri.toString())
            } catch (e: Exception) {
                promise.reject("SAVE_FAILED", e.message ?: "Failed to save image to gallery")
            }
        }.start()
    }

    /**
     * Launches Android's native file picker to pick any document (PDF, DOCX, XLSX, TXT, etc.)
     */
    @ReactMethod
    fun pickDocumentFile(mimeType: String, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        pickDocumentPromise = promise
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = if (mimeType.isNotEmpty()) mimeType else "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
                putExtra(Intent.EXTRA_LOCAL_ONLY, true)
            }
            activity.startActivityForResult(intent, PICK_DOCUMENT_REQUEST)
        } catch (e: Exception) {
            pickDocumentPromise = null
            promise.reject("PICK_ERROR", e.message ?: "Failed to launch document picker")
        }
    }

    /**
     * Renders each page of a PDF document into a high-res JPEG image in cache
     */
    @ReactMethod
    fun renderPdfPagesToImages(pdfUri: String, promise: Promise) {
        Thread {
            var pfd: ParcelFileDescriptor? = null
            var renderer: PdfRenderer? = null
            try {
                val uri = Uri.parse(pdfUri)
                val file = if (uri.scheme == "file") {
                    File(uri.path ?: "")
                } else if (uri.scheme == "content") {
                    val cached = File(reactApplicationContext.cacheDir, "temp_render_${System.currentTimeMillis()}.pdf")
                    reactApplicationContext.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(cached).use { output -> input.copyTo(output) }
                    }
                    cached
                } else {
                    File(pdfUri)
                }

                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "PDF file not found: $pdfUri")
                    return@Thread
                }

                pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                renderer = PdfRenderer(pfd)
                val count = renderer.pageCount
                val resultArray = Arguments.createArray()

                for (i in 0 until count) {
                    val page = renderer.openPage(i)
                    val width = page.width * 2
                    val height = page.height * 2
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    page.close()

                    val outFile = File(reactApplicationContext.cacheDir, "pdf_page_${System.currentTimeMillis()}_${i + 1}.jpg")
                    FileOutputStream(outFile).use { fos ->
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, fos)
                    }
                    bitmap.recycle()

                    val pageMap = Arguments.createMap().apply {
                        putInt("pageIndex", i + 1)
                        putString("uri", Uri.fromFile(outFile).toString())
                        putInt("width", width)
                        putInt("height", height)
                    }
                    resultArray.pushMap(pageMap)
                }

                val map = Arguments.createMap().apply {
                    putInt("pageCount", count)
                    putArray("pages", resultArray)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("RENDER_ERROR", e.message ?: "Failed to render PDF pages")
            } finally {
                try { renderer?.close() } catch (ignored: Exception) {}
                try { pfd?.close() } catch (ignored: Exception) {}
            }
        }.start()
    }

    /**
     * Converts a list of image URIs into a standard multi-page PDF document
     */
    @ReactMethod
    fun convertImagesToPdf(imageUris: ReadableArray, outputFileName: String, pageSize: String, promise: Promise) {
        Thread {
            try {
                val doc = PdfDocument()
                val cleanName = if (outputFileName.isNotEmpty()) {
                    val sanitized = outputFileName.replace(Regex("[^a-zA-Z0-9_.-]"), "_")
                    if (sanitized.endsWith(".pdf", ignoreCase = true)) sanitized else "$sanitized.pdf"
                } else {
                    "FIC_Document_${System.currentTimeMillis()}.pdf"
                }
                val outFile = File(reactApplicationContext.cacheDir, cleanName)

                // Page dimensions in standard PDF points (72 points = 1 inch)
                val (pageW, pageH) = when (pageSize.uppercase()) {
                    "A3" -> Pair(842, 1191)
                    "A5" -> Pair(420, 595)
                    "LETTER" -> Pair(612, 792)
                    "LEGAL" -> Pair(612, 1008)
                    "ID" -> Pair(243, 153)
                    else -> Pair(595, 842) // A4 default
                }

                var addedPages = 0

                for (i in 0 until imageUris.size()) {
                    val (uriStr, extraRotation) = try {
                        if (imageUris.getType(i) == com.facebook.react.bridge.ReadableType.Map) {
                            val map = imageUris.getMap(i)
                            Pair(map?.getString("uri") ?: "", map?.getInt("rotationDeg") ?: 0)
                        } else {
                            Pair(imageUris.getString(i) ?: "", 0)
                        }
                    } catch (e: Exception) {
                        Pair(imageUris.getString(i) ?: "", 0)
                    }

                    if (uriStr.isEmpty()) continue

                    var bmp = loadOrientedBitmap(uriStr) ?: continue

                    if (extraRotation != 0) {
                        val matrix = Matrix().apply { postRotate(extraRotation.toFloat()) }
                        val rotatedBmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
                        if (rotatedBmp != bmp) {
                            bmp.recycle()
                            bmp = rotatedBmp
                        }
                    }

                    addedPages++
                    val pageInfo = PdfDocument.PageInfo.Builder(pageW, pageH, addedPages).create()
                    val page = doc.startPage(pageInfo)

                    val scale = min(pageW.toFloat() / bmp.width, pageH.toFloat() / bmp.height)
                    val scaledW = bmp.width * scale
                    val scaledH = bmp.height * scale
                    val dx = (pageW - scaledW) / 2f
                    val dy = (pageH - scaledH) / 2f

                    val rect = android.graphics.RectF(dx, dy, dx + scaledW, dy + scaledH)
                    page.canvas.drawColor(Color.WHITE)
                    page.canvas.drawBitmap(bmp, null, rect, null)
                    doc.finishPage(page)
                    bmp.recycle()
                }

                if (addedPages == 0) {
                    doc.close()
                    promise.reject("EMPTY_DOCUMENT", "No valid images could be decoded to generate PDF")
                    return@Thread
                }

                FileOutputStream(outFile).use { fos ->
                    doc.writeTo(fos)
                }
                doc.close()

                val map = Arguments.createMap().apply {
                    putString("uri", Uri.fromFile(outFile).toString())
                    putString("fileName", cleanName)
                    putDouble("fileSizeBytes", outFile.length().toDouble())
                    putInt("pageCount", addedPages)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("CONVERT_ERROR", e.message ?: "Failed to convert images to PDF")
            }
        }.start()
    }

    /**
     * Merges multiple PDF files into a single consolidated PDF document
     */
    @ReactMethod
    fun mergePdfs(pdfUris: ReadableArray, outputFileName: String, promise: Promise) {
        Thread {
            try {
                val doc = PdfDocument()
                val cleanName = if (outputFileName.isNotEmpty()) {
                    if (outputFileName.endsWith(".pdf")) outputFileName else "$outputFileName.pdf"
                } else {
                    "Merged_${System.currentTimeMillis()}.pdf"
                }
                val outFile = File(reactApplicationContext.cacheDir, cleanName)
                var totalPages = 0

                for (i in 0 until pdfUris.size()) {
                    val uriStr = pdfUris.getString(i) ?: continue
                    val uri = Uri.parse(uriStr)
                    val file = if (uri.scheme == "file") {
                        File(uri.path ?: "")
                    } else if (uri.scheme == "content") {
                        val temp = File(reactApplicationContext.cacheDir, "merge_src_${i}.pdf")
                        reactApplicationContext.contentResolver.openInputStream(uri)?.use { inp ->
                            FileOutputStream(temp).use { out -> inp.copyTo(out) }
                        }
                        temp
                    } else {
                        File(uriStr)
                    }

                    if (!file.exists()) continue

                    val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                    val renderer = PdfRenderer(pfd)
                    for (p in 0 until renderer.pageCount) {
                        totalPages++
                        val page = renderer.openPage(p)
                        val bmp = Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(bmp)
                        canvas.drawColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        page.close()

                        val pageInfo = PdfDocument.PageInfo.Builder(bmp.width, bmp.height, totalPages).create()
                        val pdfPage = doc.startPage(pageInfo)
                        pdfPage.canvas.drawBitmap(bmp, 0f, 0f, null)
                        doc.finishPage(pdfPage)
                        bmp.recycle()
                    }
                    renderer.close()
                    pfd.close()
                }

                FileOutputStream(outFile).use { fos ->
                    doc.writeTo(fos)
                }
                doc.close()

                val map = Arguments.createMap().apply {
                    putString("uri", Uri.fromFile(outFile).toString())
                    putString("fileName", cleanName)
                    putDouble("fileSizeBytes", outFile.length().toDouble())
                    putInt("pageCount", totalPages)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("MERGE_ERROR", e.message ?: "Failed to merge PDFs")
            }
        }.start()
    }
}
