package com.connectinvest.investor.camera

import android.content.Context
import android.net.Uri
import android.util.AttributeSet
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.ReactContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

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
    private var camera: Camera? = null
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var isTorchOn: Boolean = false

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

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider?.unbindAll()
                camera = cameraProvider?.bindToLifecycle(
                    activity,
                    cameraSelector,
                    preview,
                    imageCapture
                )

                if (isTorchOn) {
                    camera?.cameraControl?.enableTorch(true)
                }
            } catch (exc: Exception) {
                exc.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
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
