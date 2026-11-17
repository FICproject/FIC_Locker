package com.ficlocker.user.camera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class InAppCameraViewManager : SimpleViewManager<InAppCameraView>() {

    override fun getName(): String = "InAppCameraView"

    override fun createViewInstance(reactContext: ThemedReactContext): InAppCameraView {
        return InAppCameraView(reactContext)
    }

    @ReactProp(name = "torchOn")
    fun setTorchOn(view: InAppCameraView, torchOn: Boolean) {
        view.setTorch(torchOn)
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        val map = super.getExportedCustomDirectEventTypeConstants() ?: mutableMapOf()
        map["onDocumentDetected"] = mapOf("registrationName" to "onDocumentDetected")
        return map
    }
}
