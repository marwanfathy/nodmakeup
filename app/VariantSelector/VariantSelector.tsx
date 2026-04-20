"use client";

import React, { FC } from "react";
import { ProductDetail, ProductVariantDetail } from "../../lib/api";
import "./VariantSelector.css";

// locally extend the type to include hexCode since it exists in DB but was missing in api.ts interface
interface VariantWithHex extends ProductVariantDetail {
  hexCode?: string | null;
}

interface VariantSelectorProps {
  product: ProductDetail;
  selectedVariant: ProductVariantDetail;
  onVariantSelect: (variant: ProductVariantDetail) => void;
}

const VariantSelector: FC<VariantSelectorProps> = ({
  product,
  selectedVariant,
  onVariantSelect,
}) => {
  return (
    <div className="variant-selector-section">
      <p className="selector-label">
        {selectedVariant.colorName && (
          <>
            Color: <span>{selectedVariant.colorName}</span>
          </>
        )}
        {selectedVariant.size && (
          <>
            {selectedVariant.colorName && " / "}
            Size: <span>{selectedVariant.size}</span>
          </>
        )}
      </p>
      <p className="product-sku">SKU: {selectedVariant.sku}</p>

      <div className="swatches">
        {product.variants.map((v) => {
          // Cast to our local type to access hexCode safely
          const variant = v as VariantWithHex;
          const isActive = selectedVariant.id === variant.id;

          // Logic: Prioritize hexCode, then size, then image.
          if (variant.hexCode) {
            return (
              <button
                key={variant.id}
                className={`color-swatch ${isActive ? "active" : ""}`}
                title={variant.colorName || ""}
                onClick={() => onVariantSelect(variant)}
                style={{ backgroundColor: variant.hexCode }}
              />
            );
          } else if (variant.size) {
            return (
              <button
                key={variant.id}
                className={`size-swatch ${isActive ? "active" : ""}`}
                title={variant.size}
                onClick={() => onVariantSelect(variant)}
              >
                {variant.size}
              </button>
            );
          }

          // Fallback to image if no hexCode or size is available.
          // FIX: 'general_images' does not exist. We fallback to the current variant's image,
          // or the first image of the first variant in the product list.
          const swatchImageUrl =
            variant.images?.[0]?.imageUrl ||
            product.variants[0]?.images?.[0]?.imageUrl ||
            "/default-image.png";

          return (
            <button
              key={variant.id}
              className={`image-swatch ${isActive ? "active" : ""}`}
              title={variant.colorName || ""}
              onClick={() => onVariantSelect(variant)}
            >
              <img src={swatchImageUrl} alt={variant.colorName || ""} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VariantSelector;
