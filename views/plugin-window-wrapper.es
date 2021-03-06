import React, { PureComponent } from 'react'
import ReactDOM from 'react-dom'
import path from 'path-extra'
import { TitleBar } from 'electron-react-titlebar'
import { normalizeURL } from 'views/utils/tools'
import PropTypes from 'prop-types'

const pickOptions = ['ROOT', 'EXROOT', 'toast', 'notify', 'toggleModal', 'i18n', 'config', 'getStore']

export class PluginWindowWrap extends PureComponent {
  constructor(props) {
    super(props)
    this.containerEl = document.createElement('div')
    this.containerEl.id = "plugin-mountpoint"
    this.containerEl.style['display'] = 'flex'
    this.containerEl.style['flex-direction'] = "column"
    this.containerEl.style['height'] = "100vh"
    this.externalWindow = null
  }

  state = {}

  getChildContext() {
    return {
      overlayMountPoint: this.containerEl,
      window: this.externalWindow,
    }
  }

  static childContextTypes = {
    overlayMountPoint: PropTypes.instanceOf(<div></div>),
    window: PropTypes.object,
  }

  componentDidMount() {
    try {
      this.initWindow()
    } catch(e) {
      console.error(e)
      this.props.closeWindowPortal()
    }
  }

  componentWillUnmount() {
    this.externalWindow.close()
  }

  componentDidCatch = (error, info) => {
    console.error(error, info)
    this.setState({
      hasError: true,
    })
    this.externalWindow.close()
  }

  initWindow = () => {
    const windowOptions = this.props.plugin.windowOptions || { width: 600, height: 500 }
    const windowFeatures = Object.keys(windowOptions).map(key => {
      switch (key) {
      case 'x': return `left=${windowOptions.x}`
      case 'y': return `top=${windowOptions.y}`
      case 'width': return `width=${windowOptions.width}`
      case 'height': return `height=${windowOptions.height}`
      }
    }).join(',')
    this.externalWindow = window.open(`file:///${__dirname}/index-plugin.html?${this.props.plugin.id}`, 'plugin', windowFeatures)
    this.externalWindow.addEventListener('DOMContentLoaded', e => {
      this.externalWindow.document.head.innerHTML =
`<meta charset="utf-8">
<link rel="stylesheet" type="text/css" id="bootstrap-css">
<link rel="stylesheet" type="text/css" id="fontawesome-css">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('assets/css/app.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('assets/css/global.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('electron-react-titlebar/assets/style.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('react-resizable/css/styles.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('react-grid-layout/css/styles.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('views/components/etc/assets/avatar.css'))}">
<link rel="stylesheet" type="text/css" href="${normalizeURL(require.resolve('views/components/etc/assets/scroll-shadow.css'))}">`
      if (process.platform === 'darwin') {
        const div = document.createElement("div")
        div.style.position = "absolute"
        div.style.top = 0
        div.style.height = "23px"
        div.style.width = "100%"
        div.style["-webkit-app-region"] = "drag"
        div.style["pointer-events"] = "none"
        this.externalWindow.document.body.appendChild(div)
      }
      this.externalWindow.document.body.appendChild(this.containerEl)
      this.externalWindow.document.title = this.props.plugin.name
      this.externalWindow.isWindowMode = true
      if (require.resolve(path.join(__dirname, 'env-parts', 'theme')).endsWith('.es')) {
        this.externalWindow.require('@babel/register')(this.externalWindow.require(path.join(window.ROOT, 'babel.config')))
      }
      this.externalWindow.$ = param => this.externalWindow.document.querySelector(param)
      this.externalWindow.$$ = param => this.externalWindow.document.querySelectorAll(param)
      this.externalWindow.remote = this.externalWindow.require('electron').remote
      for (const pickOption of pickOptions) {
        this.externalWindow[pickOption] = window[pickOption]
      }
      this.externalWindow.require(require.resolve('./env-parts/theme'))
      this.externalWindow.addEventListener('beforeunload', () => {
        this.props.closeWindowPortal()
      })
      this.setState({ loaded: true })
    })
  }

  focusWindow = () => this.externalWindow.require('electron').remote.getCurrentWindow().focus()

  render() {
    if (this.state.hasError || !this.state.loaded) return null
    return ReactDOM.createPortal(
      <>
        {
          window.config.get('poi.useCustomTitleBar', process.platform === 'win32' || process.platform === 'linux') &&
          <TitleBar icon={path.join(window.ROOT, 'assets', 'icons', 'poi_32x32.png')} currentWindow={this.externalWindow.require('electron').remote.getCurrentWindow()} />
        }
        <div className="poi-app-tabpane poi-plugin" style={{ flex: 1, overflow: 'auto' }}>
          <this.props.plugin.reactClass />
        </div>
      </>,
      this.externalWindow.document.querySelector('#plugin-mountpoint'))
  }
}
