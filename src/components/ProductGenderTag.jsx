import React from "react";
import { getProductGender, PRODUCT_GENDER_OPTIONS } from "../data/productGender.js";

const genderTagStyles = {
  boys: { background: "#EAF4FF", color: "#315A7D", borderColor: "#D4E5F7" },
  girls: { background: "#FFF0F5", color: "#8C5268", borderColor: "#F3D9E2" },
  unisex: { background: "#F1F3F5", color: "#58636F", borderColor: "#E1E5E9" },
};

export const ProductGenderTag = ({ product }) => {
  const gender = getProductGender(product);
  const label = PRODUCT_GENDER_OPTIONS.find((option) => option.value === gender)?.label;

  return (
    <span
      aria-label={`適用性別：${label}`}
      style={{
        ...genderTagStyles[gender],
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        border: "1px solid",
        borderRadius: 999,
        padding: "3px 7px",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};
