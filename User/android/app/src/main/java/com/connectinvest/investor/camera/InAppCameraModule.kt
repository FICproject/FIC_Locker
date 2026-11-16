package com.connectinvest.investor.camera

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

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

        view.capturePhoto(
            onSuccess = { uri, width, height ->
                val map = Arguments.createMap()
                map.putString("uri", uri)
                map.putInt("width", width)
                map.putInt("height", height)
                promise.resolve(map)
            },
            onError = { errMsg ->
                promise.reject("CAPTURE_FAILED", errMsg)
            }
        )
    }
}
