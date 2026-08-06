import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ConfigProvider locale={viVN} theme={{token:{colorPrimary:'#1677ff',borderRadius:10,fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'}}}><BrowserRouter><App/></BrowserRouter></ConfigProvider></React.StrictMode>
)
