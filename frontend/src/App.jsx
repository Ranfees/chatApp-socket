import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {Route, Routes} from 'react-router'
import Login from './pages/Login'
import Signup from './pages/SignUp'
import Home from "./pages/Home";


function App() {

  return (
    <>
      <Routes>
         <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </>
  )
}

export default App
