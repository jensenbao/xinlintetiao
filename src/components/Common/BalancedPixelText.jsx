import React from "react";
import "./BalancedPixelText.css";

const BalancedPixelText = ({ text, className = "", style = {} }) => {
  if (!text) return null;

  // Split by ASCII (English, numbers, basic punctuation).
  // This will separate things like "(Enter" and "发送", ", Shift+Enter" and "换行)"
  const segments = text.split(/([\x00-\x7F]+)/);

  return (
    <span className={`balanced-pixel-text ${className}`} style={style}>
      {segments.map((segment, index) => {
        if (!segment) return null;

        // Check if the segment is strictly ASCII
        const isAscii = /^[\x00-\x7F]+$/.test(segment);

        if (isAscii) {
          return (
            <span key={index} className="pixel-text-en">
              {segment}
            </span>
          );
        } else {
          return (
            <span key={index} className="pixel-text-zh">
              {segment}
            </span>
          );
        }
      })}
    </span>
  );
};

export default BalancedPixelText;

