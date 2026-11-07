// Save a photo to the phone. On a phone the share sheet is the way into the
// camera roll ("Save Image"); a laptop just downloads the file.
export async function savePhoto(url, name = 'ets-photo') {
  try {
    const res = await fetch(url, { mode: 'cors' })
    const blob = await res.blob()
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const file = new File([blob], `${name}.${ext}`, { type: blob.type || 'image/jpeg' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] })
      return true
    }
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 4000)
    return true
  } catch (err) {
    // The share sheet closed without saving is not an error worth showing.
    if (err?.name === 'AbortError') return false
    window.open(url, '_blank', 'noopener')
    return false
  }
}
