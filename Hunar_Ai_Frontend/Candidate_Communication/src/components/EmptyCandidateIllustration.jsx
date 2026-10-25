import React from 'react';

export default function EmptyCandidateIllustration({ className = '', width = 200, height = 150 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 180"
      width={width}
      height={height}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* Ground subtle shadow */}
      <ellipse cx="120" cy="148" rx="75" ry="12" fill="#f1f5f9" />

      {/* POTTED PLANT */}
      {/* Plant Pot */}
      <g id="potted-plant">
        {/* Pot shadow */}
        <ellipse cx="128" cy="108" rx="15" ry="5" fill="#e2e8f0" />
        
        {/* Pot Base Body */}
        <path
          d="M 115 76 L 119 104 C 119 107 137 107 137 104 L 141 76 Z"
          fill="#ffffff"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Pot Rim */}
        <ellipse
          cx="128"
          cy="76"
          rx="13"
          ry="4"
          fill="#f8fafc"
          stroke="#475569"
          strokeWidth="1.5"
        />

        {/* Succulent Blue Leaves */}
        {/* Back Leaves */}
        <path
          d="M 128 75 C 122 66 120 54 124 48 C 129 55 130 67 128 75 Z"
          fill="#60a5fa"
          stroke="#2563eb"
          strokeWidth="1.3"
        />
        <path
          d="M 128 75 C 134 66 136 54 132 48 C 127 55 126 67 128 75 Z"
          fill="#3b82f6"
          stroke="#1d4ed8"
          strokeWidth="1.3"
        />
        {/* Center Main Leaf */}
        <path
          d="M 128 75 C 124 64 125 46 128 42 C 131 46 132 64 128 75 Z"
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="1.3"
        />
        {/* Side Leaves */}
        <path
          d="M 125 76 C 116 71 112 60 117 56 C 122 61 125 70 125 76 Z"
          fill="#93c5fd"
          stroke="#2563eb"
          strokeWidth="1.3"
        />
        <path
          d="M 131 76 C 140 71 144 60 139 56 C 134 61 131 70 131 76 Z"
          fill="#2563eb"
          stroke="#1d4ed8"
          strokeWidth="1.3"
        />
      </g>

      {/* ISOMETRIC RESUME / DOCUMENT */}
      <g id="document">
        {/* Paper bottom thickness/bevel */}
        <path
          d="M 52 126 L 52 130 L 114 162 L 174 127 L 174 123 L 114 158 Z"
          fill="#93c5fd"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Paper surface (isometric plane) */}
        <path
          d="M 114 90 L 52 126 L 114 158 L 174 123 Z"
          fill="#dbeafe"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Paper Clip at Top */}
        <path
          d="M 108 93 L 118 87 L 126 91 L 116 97 Z"
          fill="#cbd5e1"
          stroke="#475569"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Profile Card / Avatar Box */}
        <g id="doc-avatar">
          {/* Avatar box outline */}
          <path
            d="M 72 118 L 88 109 L 98 114 L 82 123 Z"
            fill="#ffffff"
            stroke="#60a5fa"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Head & shoulders silhouette */}
          <ellipse cx="85" cy="115" rx="3.5" ry="2.2" fill="#3b82f6" />
          <path
            d="M 79 121 C 80 118 90 113 91 117 Z"
            fill="#3b82f6"
          />
        </g>

        {/* Text Lines on Document */}
        <path d="M 104 110 L 138 90" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 108 116 L 142 96" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 68 132 L 124 100" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        <path d="M 74 138 L 130 106" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        <path d="M 80 144 L 120 121" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* ISOMETRIC BLUE NOTEBOOK / BOOK */}
      <g id="notebook">
        {/* Book shadow */}
        <path
          d="M 172 122 L 188 113 L 204 122 L 188 131 Z"
          fill="#e2e8f0"
        />
        {/* Book Cover Top */}
        <path
          d="M 172 112 L 188 103 L 204 112 L 188 121 Z"
          fill="#2563eb"
          stroke="#1e40af"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Book Pages Side */}
        <path
          d="M 172 112 L 172 120 L 188 129 L 188 121 Z"
          fill="#ffffff"
          stroke="#1e40af"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Book Spine / Right edge */}
        <path
          d="M 188 121 L 188 129 L 204 120 L 204 112 Z"
          fill="#1d4ed8"
          stroke="#1e40af"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Bookmark ribbon or cover pattern */}
        <path d="M 180 108 L 186 114" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 188 107 L 194 113" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* MAGNIFYING GLASS */}
      <g id="magnifier">
        {/* Handle */}
        <path
          d="M 132 150 L 152 163"
          stroke="#0f172a"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 133 151 L 151 162"
          stroke="#0284c7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Lens Rim Outer */}
        <ellipse
          cx="123"
          cy="143"
          rx="15"
          ry="10"
          fill="#e0f2fe"
          fillOpacity="0.85"
          stroke="#0284c7"
          strokeWidth="2"
        />
        {/* Inner rim border */}
        <ellipse
          cx="123"
          cy="143"
          rx="12"
          ry="8"
          fill="#f0f9ff"
          fillOpacity="0.75"
          stroke="#38bdf8"
          strokeWidth="1"
        />
        {/* Glass glare highlight */}
        <path
          d="M 115 141 C 117 137 125 137 129 139"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
