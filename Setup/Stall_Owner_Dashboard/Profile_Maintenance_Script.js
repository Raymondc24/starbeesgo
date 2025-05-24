// Assumes Firebase is already initialized in the HTML

const urlParams = new URLSearchParams(window.location.search);
const stallId = urlParams.get("stallId");

const stallNameInput = document.getElementById("stallName");
const nicknameInput = document.getElementById("nickname");
const phoneInput = document.getElementById("phoneNumber");
const stallImageInput = document.getElementById("stallImage");
const stallImagePreview = document.getElementById("stallImagePreview");
const profileForm = document.getElementById("profileForm");
const backButton = document.getElementById("backButton");

// Replace YOUR_IMGBB_API_KEY with your actual imgbb API key
const IMGBB_API_KEY = "ab0d3666bcb268fd34d6456bb492cf0e"; // Get one for free at https://api.imgbb.com/

// Load stall data
async function loadStallProfile() {
  if (!stallId) return;
  const stallDoc = await db.collection("stalls").doc(stallId).get();
  if (stallDoc.exists) {
    const data = stallDoc.data();
    stallNameInput.value = data.name || "";
    nicknameInput.value = data.nickname || "";
    phoneInput.value = data.phone || "";
    stallImagePreview.src = data.imageUrl || "default-stall.png";
  }
}

// Image preview
stallImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      stallImagePreview.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

async function uploadImageToImgbb(file) {
  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

  const base64 = await toBase64(file);
  const formData = new FormData();
  formData.append("key", IMGBB_API_KEY);
  formData.append("image", base64);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });
  const result = await response.json();
  if (result.success) {
    return result.data.url;
  } else {
    throw new Error("Image upload failed!");
  }
}

// Save profile
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  let imageUrl = stallImagePreview.src;

  const file = stallImageInput.files[0];
  if (file) {
    try {
      imageUrl = await uploadImageToImgbb(file);
    } catch (err) {
      alert("Image upload failed!");
      return;
    }
  }

  // Update Firestore
  await db.collection("stalls").doc(stallId).update({
    name: stallNameInput.value,
    nickname: nicknameInput.value,
    phone: phoneInput.value,
    imageUrl: imageUrl,
  });

  alert("Profile updated!");
});

// Back button
backButton.addEventListener("click", () => {
  window.location.href = `Stall_Screen_Index.html?stallId=${stallId}`;
});

// Load on page ready
document.addEventListener("DOMContentLoaded", loadStallProfile);