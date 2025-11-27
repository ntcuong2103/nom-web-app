import React from "react";
import { useNavigate } from "react-router-dom";

export default function ModePicker() {
  const nav = useNavigate();
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
        <button
          onClick={() => nav("/")}
          className="hover:text-blue-400 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1 inline"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Home
        </button>
        <span>Annotation Workspace</span>
      </div>

      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4 text-slate-200">
          Choose Annotation Mode
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Select your preferred annotation workflow based on your requirements
          and available resources.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div
          className="feature-card group cursor-pointer"
          onClick={() => nav("/workspace/manual")}
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/20 transition-colors">
              <svg
                className="w-8 h-8 text-blue-400"
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
            <h3 className="text-2xl font-semibold mb-3 text-slate-200">
              Manual Annotation
            </h3>
          </div>
          <p className="text-slate-400 text-center mb-6 leading-relaxed">
            Upload images with existing label files for viewing and editing
            annotations.
          </p>
          <button className="btn w-full group-hover:scale-105 transition-transform">
            Choose Manual Mode
          </button>
        </div>

        <div
          className="feature-card group cursor-pointer"
          onClick={() => nav("/workspace/api")}
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/20 transition-colors">
              <svg
                className="w-8 h-8 text-green-400"
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
            <h3 className="text-2xl font-semibold mb-3 text-slate-200">
              API Annotation
            </h3>
          </div>
          <p className="text-slate-400 text-center mb-6 leading-relaxed">
            Upload images and generate annotations automatically using AI API
            integration.
          </p>
          <button className="btn w-full bg-green-500 hover:bg-green-600 group-hover:scale-105 transition-transform">
            Choose API Mode
          </button>
        </div>
      </div>
    </div>
  );
}
