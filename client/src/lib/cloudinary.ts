const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "placeholder";
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "feminine_elegance";

// Function to upload an image to Cloudinary
export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw error;
  }
}

// Function to upload multiple images
export async function uploadMultipleImages(files: File[]) {
  const uploadPromises = files.map(file => uploadImage(file));
  return Promise.all(uploadPromises);
}

// Function to get a transformed image URL
export function getImageUrl(publicId: string, options = {}) {
  const { width, height, crop } = options as { width?: number; height?: number; crop?: string };
  
  let transformations = '';
  
  if (width) transformations += `w_${width},`;
  if (height) transformations += `h_${height},`;
  if (crop) transformations += `c_${crop},`;
  
  // Remove trailing comma
  if (transformations.endsWith(',')) {
    transformations = transformations.slice(0, -1);
  }
  
  const transformationString = transformations ? `${transformations}/` : '';
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformationString}${publicId}`;
}
