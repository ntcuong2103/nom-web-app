import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./components/Home.jsx";
import ModePicker from "./components/ModePicker.jsx";
import FileManager from "./components/FileManager.jsx";
import AnnotationEditor from "./components/AnnotationEditor.jsx";

const Navbar = () => (
  <div className="border-b border-slate-800/50 bg-bg/95 backdrop-blur-sm sticky top-0 z-50">
    <div className="max-w-6xl mx-auto px-6">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3 font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <span className="text-white text-lg">🌏</span>
          </div>
          <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Hán-Nôm Annotator
          </span>
        </div>
        <nav className="flex gap-6 text-slate-300">
          <Link
            to="/"
            className="hover:text-blue-400 transition-colors font-medium"
          >
            Home
          </Link>
          <a
            className="hover:text-blue-400 transition-colors font-medium"
            target="_blank"
            href="https://annotorious.dev/"
          >
            Documentation
          </a>
          <a
            className="hover:text-blue-400 transition-colors font-medium"
            href="#about"
          >
            About
          </a>
        </nav>
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace" element={<ModePicker />} />
        <Route path="/workspace/manual" element={<FileManager />} />
        <Route path="/workspace/manual/editor" element={<AnnotationEditor />} />
        <Route path="/workspace/api" element={<FileManager apiMode />} />
      </Routes>
      <footer className="text-center text-slate-400 py-0">
        © 2025 Han-Nom Tools
      </footer>
    </>
  );
}
