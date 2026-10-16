class LoadingIndicator {
  public loadingElement: HTMLDivElement

  private setStyle() {
    this.loadingElement.style.display = 'flex'
    this.loadingElement.style.alignItems = 'center'
    this.loadingElement.style.justifyContent = 'center'
    this.loadingElement.style.zIndex = '90000'
    this.loadingElement.style.background = 'transparent'
    this.loadingElement.style.border = 'none'
    this.loadingElement.style.padding = '0'
    this.loadingElement.style.width = '80px'
    this.loadingElement.style.height = '80px'
    // Centered inside the viewer wrapper (which is `position: relative`), not the window.
    this.loadingElement.style.position = 'absolute'
    this.loadingElement.style.top = '50%'
    this.loadingElement.style.left = '50%'
    this.loadingElement.style.transform = 'translate(-50%, -50%)'
    this.loadingElement.style.pointerEvents = 'none'
    this.loadingElement.innerHTML = `
            <div style="
                border: 8px solid #f3f3f3;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                width: 48px;
                height: 48px;
                animation: pdf-web-viewer-spin 1s linear infinite;
            "></div>
            <style>
                @keyframes pdf-web-viewer-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `
  }

  private constructor() {
    this.loadingElement = document.createElement('div')
    this.loadingElement.className = 'pdf-web-viewer-loading-indicator'
    this.setStyle()
  }

  public static create() {
    return new LoadingIndicator()
  }

  public show() {
    this.loadingElement.style.display = 'flex'
  }

  public hide() {
    this.loadingElement.style.display = 'none'
  }
}

const create = (): LoadingIndicator => {
  return LoadingIndicator.create()
}

export { create }
