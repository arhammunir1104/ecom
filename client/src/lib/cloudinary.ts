const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "placeholder";
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "feminine_elegance";

// Mock function to handle image uploads without Cloudinary
export async function uploadImage(file: File) {
  try {
    // Create a data URL for the image
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    
    // Return a mock response with the data URL
    return {
      url: dataUrl,
      publicId: `local_${Date.now()}`,
    };
  } catch (error) {
    console.error("Error handling local image:", error);
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
