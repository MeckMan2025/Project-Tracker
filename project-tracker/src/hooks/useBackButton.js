import { useEffect } from 'react'
import { isNative } from '../utils/platform'

export function useBackButton(onBack) {
  useEffect(() => {
    if (!isNative) return

    let App
    import(/* @vite-ignore */ '@capacitor/app').then(mod => {
      App = mod.App
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else if (onBack) {
          onBack()
        } else {
          App.minimizeApp()
        }
      })
    }).catch(() => {})

    return () => {
      if (App) App.removeAllListeners()
    }
  }, [onBack])
}
