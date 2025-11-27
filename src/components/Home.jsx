import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Hero Section */}
      <section className="text-center py-20">
        <div className="mb-8">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Advanced Chinese Character
          </h1>
          <h2 className="text-5xl font-bold text-blue-400">Annotation Tool</h2>
        </div>
        <p className="text-lg text-slate-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          Powerful web-based tool for annotating Hán-Nôm characters in
          historical documents. Upload images, create precise bounding boxes,
          and manage your annotation datasets efficiently.
        </p>
        <button
          className="btn text-lg px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          onClick={() => nav("/workspace")}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Start Annotating
        </button>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <h3 className="text-3xl font-bold text-center mb-12 text-slate-200">
          Key Features
        </h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="feature-card group hover:scale-105 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h4 className="text-xl font-semibold mb-3 text-slate-200">
              Flexible Upload
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Upload individual files or entire folders. Automatic matching of
              images with label files for seamless workflow.
            </p>
          </div>

          <div className="feature-card group hover:scale-105 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h4 className="text-xl font-semibold mb-3 text-slate-200">
              Precise Annotation
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Advanced bounding box editing with Annotorious integration for
              accurate character annotation.
            </p>
          </div>

          <div className="feature-card group hover:scale-105 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h4 className="text-xl font-semibold mb-3 text-slate-200">
              AI Integration
            </h4>
            <p className="text-slate-400 leading-relaxed">
              API-powered automatic annotation with manual editing capabilities
              for enhanced accuracy.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
