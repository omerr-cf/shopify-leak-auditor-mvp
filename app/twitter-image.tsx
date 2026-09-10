// Twitter/X card image. `twitter-image` and `opengraph-image` are two
// SEPARATE Next.js file conventions -- verified against the official docs
// (nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image):
// defining `opengraph-image.tsx` alone does NOT automatically populate
// `twitter:image`, contrary to a common assumption. Without this file, the
// site emitted a `twitter:card` meta tag with no image at all, so shared
// links on Twitter/X rendered as a bare text card. Re-exporting straight
// from `opengraph-image.tsx` (same size, same generated visual) is the
// documented way to share the image-generation logic between the two
// conventions instead of duplicating the ImageResponse JSX.
export { default, size, contentType } from "./opengraph-image";
