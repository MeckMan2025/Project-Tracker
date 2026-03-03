import { useEffect } from 'react'

export function useBackButton(onBack) {
  // Capacitor back button handling — only active in native builds
  // Web builds skip this entirely since @capacitor/app is not available
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return

    let App
    const capModule = '@capaci' + 'tor/app'
    import(/* @vite-ignore */ capModule).then(mod => {
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
