// DOM references
const foodForm = document.getElementById('foodForm');
const foodNameInput = document.getElementById('foodName');
const foodCategoryInput = document.getElementById('foodCategory');
const foodPriceInput = document.getElementById('foodPrice');
const foodImageInput = document.getElementById('foodImageInput');
const chooseImageBtn = document.getElementById('chooseImageBtn');
const removeImageBtn = document.getElementById('removeImageBtn');
const previewImg = document.getElementById('imagePreview');
const datalist = document.getElementById('categoryList');
const tbody = document.querySelector('#foodTable tbody');
const submitButton = foodForm.querySelector('button[type="submit"]');
const formHeading = document.querySelector('#formHeading');

let currentImageURL = '';
const urlParams = new URLSearchParams(window.location.search);
const stallId = urlParams.get("stallId");
let editingFoodId = null;

let currentSortField = 'category'; // Default sort field is category
let currentSortDirection = 'asc'; // Default sort direction is ascending

chooseImageBtn.onclick = () => foodImageInput.click();

foodImageInput.onchange = () => {
  const file = foodImageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    currentImageURL = reader.result;
    previewImg.src = currentImageURL;
    previewImg.hidden = false;
    removeImageBtn.hidden = false;
  };
  reader.readAsDataURL(file);
};

removeImageBtn.onclick = () => {
  currentImageURL = '';
  previewImg.hidden = true;
  previewImg.src = '';
  removeImageBtn.hidden = true;
  foodImageInput.value = '';
};

foodForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = foodNameInput.value.trim();
  const category = foodCategoryInput.value.trim();
  const price = parseFloat(foodPriceInput.value);
  const available = true;

  if (!name || !category || isNaN(price)) return;

  const newFood = { name, category, price, img: currentImageURL, available, stallId };

  try {
    if (editingFoodId) {
      await firebase.firestore().collection('foods').doc(editingFoodId).update(newFood);
      editingFoodId = null;
      submitButton.textContent = "Add Food";
      formHeading.textContent = "Add New Food";
    } else {
      await firebase.firestore().collection('foods').add(newFood);
    }

    foodForm.reset();
    removeImageBtn.click();
    loadFoods();
  } catch (err) {
    console.error('Error saving food:', err);
  }
};

// Updated sorting logic to handle availability, category, and name
async function loadFoods() {
  try {
    const snapshot = await firebase.firestore()
      .collection('foods')
      .where('stallId', '==', stallId)
      .get();

    let foods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sorting based on currentSortField and currentSortDirection
    foods.sort((a, b) => {
      // Sorting by availability
      if (currentSortField === 'available') {
        // First, sort by availability
        if (a.available !== b.available) {
          return currentSortDirection === 'asc' ? (a.available ? -1 : 1) : (a.available ? 1 : -1);
        }

        // After sorting by availability, sort by category in ascending order
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;

        // Then, sort by food name in ascending order within each category
        return a.name.localeCompare(b.name);
      }

      // Sorting by category
      if (currentSortField === 'category') {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) {
          return categoryCompare * (currentSortDirection === 'asc' ? 1 : -1);
        }

        // After sorting by category, ensure the names are always in ascending order within categories
        return a.name.localeCompare(b.name); // Ensure names are sorted ascending
      }

      // Sorting by name
      if (currentSortField === 'name') {
        return a.name.localeCompare(b.name) * (currentSortDirection === 'asc' ? 1 : -1);
      }

      // Sorting by price
      if (currentSortField === 'price') {
        return currentSortDirection === 'asc' ? a.price - b.price : b.price - a.price;
      }

      return 0;
    });

    tbody.innerHTML = ''; // Clear existing table rows

    // Render the sorted foods
    foods.forEach((food, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${food.img ? `<img src="${food.img}" alt="food" style="width: 50px; height: 50px; object-fit: cover;">` : ''}</td>
        <td>${food.name}</td>
        <td>${food.category}</td>
        <td>RM${food.price.toFixed(2)}</td>
        <td>
          <input type="checkbox" ${food.available ? 'checked' : ''} onchange="toggleAvail('${food.id}', this.checked)">
        </td>
        <td>
          <button onclick="editFood('${food.id}')">Edit</button>
          <button onclick="removeFood('${food.id}')">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updateCategoryOptions(); // Update category options
  } catch (err) {
    console.error('Error loading foods:', err);
  }
}

function setSort(field) {
  // Toggle sort direction for the selected field
  if (currentSortField === field) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortField = field;
    currentSortDirection = 'asc';
  }
  loadFoods();
}

window.setSort = setSort;

window.toggleAvail = async (docId, status) => {
  try {
    await firebase.firestore().collection('foods').doc(docId).update({ available: status });
    loadFoods();
  } catch (err) {
    console.error('Error updating availability:', err);
  }
};

window.removeFood = async (docId) => {
  try {
    await firebase.firestore().collection('foods').doc(docId).delete();
    loadFoods();
  } catch (err) {
    console.error('Error removing food:', err);
  }
};

window.editFood = async (docId) => {
  try {
    const doc = await firebase.firestore().collection('foods').doc(docId).get();
    if (!doc.exists) return;

    const food = doc.data();
    foodNameInput.value = food.name;
    foodCategoryInput.value = food.category;
    foodPriceInput.value = food.price;
    previewImg.src = food.img;
    previewImg.hidden = !food.img;
    removeImageBtn.hidden = !food.img;
    currentImageURL = food.img;

    editingFoodId = docId;
    submitButton.textContent = "Done";
    formHeading.textContent = "Edit Food Info";
  } catch (err) {
    console.error('Error fetching food for edit:', err);
  }
};

async function updateCategoryOptions() {
  try {
    const snapshot = await firebase.firestore()
      .collection('foods')
      .where('stallId', '==', stallId)
      .get();
    const categories = new Set();
    snapshot.docs.forEach(doc => {
      categories.add(doc.data().category);
    });
    datalist.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      datalist.appendChild(opt);
    });
  } catch (err) {
    console.error('Error updating category options:', err);
  }
}

loadFoods();

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = `../Stall_Owner_Dashboard/Stall_Screen_Index.html?stallId=${stallId}`;
});