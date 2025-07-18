// Initialize a secondary Firebase app for user creation
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

// Global variable to track editing user ID
let editingUserId = null;

// Add global sort state
let currentSort = { field: null, direction: 1 };

// Create user
document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const name = document.getElementById("name");
  const role = document.getElementById("role");

  if (editingUserId) {
    // Update existing user
    try {
      await db.collection("users").doc(editingUserId).update({
        name: name.value,
        email: email.value,
        role: role.value
      });

      // Update password in Auth if a new password is provided
      if (password.value) {
        // You need to use the Admin SDK on the server to update another user's password securely.
        // On the client, you can only update the password for the currently signed-in user.
        // So here, just show a message or handle as needed.
        alert("Password change for other users requires server-side (Admin SDK) code.");
      }

      alert("User updated successfully!");
      editingUserId = null;
      document.querySelector("#userForm button[type='submit']").textContent = "Create User";
      loadUsers(role.value);
      // Reset form
      email.value = "";
      password.value = "";
      name.value = "";
      role.selectedIndex = 0;
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  // Create new user
  try {
    // Create user with secondary app so it doesn't affect current session
    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email.value, password.value);
    const userId = userCredential.user.uid;

    // Generate a unique stall ID for stall owners
    const stallId = role.value === "stall_owner" ? `stall_${Date.now()}` : null;

    // Add user details to Firestore
    await db.collection("users").doc(userId).set({
      email: email.value,
      name: name.value,
      role: role.value,
      stallId, // Add stallId for stall owners
    });

    // Add stall details for stall owners
    if (role.value === "stall_owner") {
      await db.collection("stalls").doc(stallId).set({
        stallId,
        name: name.value,
        ownerId: userId,
        imageUrl: "default-stall.png", // Default image for the stall
      });

      // Add this stall to all students' registeredStalls
      const studentsSnap = await db.collection("users").where("role", "==", "student").get();
      const batch = db.batch();
      studentsSnap.forEach(studentDoc => {
        const studentRef = db.collection("users").doc(studentDoc.id);
        const prev = studentDoc.data().registeredStalls || [];
        if (!prev.includes(stallId)) {
          batch.update(studentRef, { registeredStalls: [...prev, stallId] });
        }
      });
      await batch.commit();
    }

    // Assign all stalls to the new student
    if (role.value === "student") {
      const stallsSnap = await db.collection("stalls").get();
      const allStallIds = stallsSnap.docs.map(doc => doc.id);
      await db.collection("users").doc(userId).update({
        registeredStalls: allStallIds
      });
    }

    alert("User created successfully!");
    loadUsers(role.value); // Refresh user list

    // Clear the form inputs
    email.value = "";
    password.value = "";
    name.value = "";
    role.selectedIndex = 0; // Reset to the first option in the dropdown

    // Sign out secondary app to keep it clean
    await secondaryApp.auth().signOut();
  } catch (error) {
    alert(error.message);
  }
});

// Update loadUsers function
async function loadUsers(role) {
  const userTable = document.getElementById("userTable");
  const userTableBody = document.getElementById("userTableBody");
  const tableHeader = document.getElementById("tableHeader");

  // Clear existing table content
  userTableBody.innerHTML = "";
  tableHeader.innerHTML = "";

  // Set table headers (no sort buttons)
  if (role === "student") {
    tableHeader.innerHTML = `
      <th>Full Name</th>
      <th>Email</th>
      <th>Role</th>
      <th>Action</th>
    `;
  } else if (role === "stall_owner") {
    tableHeader.innerHTML = `
      <th>Full Name</th>
      <th>Email</th>
      <th>Role</th>
      <th>Stall ID</th>
      <th>Action</th>
    `;
  }

  // Fetch users from Firestore
  let usersSnapshot = await db.collection("users").where("role", "==", role).get();
  let users = [];
  usersSnapshot.forEach((doc) => {
    users.push({ id: doc.id, ...doc.data() });
  });

  // Student: always sort by name ascending
  if (role === "student") {
    users.sort((a, b) => {
      let valA = (a.name || "").toLowerCase();
      let valB = (b.name || "").toLowerCase();
      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });

    users.forEach((userData) => {
      const userRow = document.createElement("tr");
      userRow.innerHTML = `
        <td>${userData.name}</td>
        <td>${userData.email}</td>
        <td>${userData.role}</td>
        <td>
          <button onclick="editUser('${userData.id}')">Edit</button>
          <button onclick="removeUser('${userData.id}')">Remove</button>
        </td>
      `;
      userTableBody.appendChild(userRow);
    });
  }

  // Stall owner: manual arrangement (drag-and-drop)
  if (role === "stall_owner") {
    // Sort by order field first (default)
    users.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    users.forEach((userData, idx) => {
      const userRow = document.createElement("tr");
      userRow.setAttribute("draggable", "true");
      userRow.dataset.index = idx;
      userRow.dataset.userid = userData.id;

      userRow.innerHTML = `
        <td>${userData.name}</td>
        <td>${userData.email}</td>
        <td>${userData.role}</td>
        <td>${userData.stallId}</td>
        <td>
          <button onclick="editUser('${userData.id}')">Edit</button>
          <button onclick="removeUser('${userData.id}')">Remove</button>
        </td>
      `;

      // Drag events
      userRow.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", idx);
        userRow.classList.add("dragging");
      };
      userRow.ondragend = () => {
        userRow.classList.remove("dragging");
      };
      userRow.ondragover = (e) => {
        e.preventDefault();
        userRow.classList.add("drag-over");
      };
      userRow.ondragleave = () => {
        userRow.classList.remove("drag-over");
      };
      userRow.ondrop = async (e) => {
        e.preventDefault();
        userRow.classList.remove("drag-over");
        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
        const toIdx = idx;
        if (fromIdx === toIdx) return;

        // Reorder users array
        const moved = users.splice(fromIdx, 1)[0];
        users.splice(toIdx, 0, moved);

        // Update order field in Firestore for all stall owners
        const batch = db.batch();
        users.forEach((u, i) => {
          batch.update(db.collection("users").doc(u.id), { order: i });
          // Also update the stall document for student dashboard sorting
          if (u.stallId) {
            batch.update(db.collection("stalls").doc(u.stallId), { order: i });
          }
        });
        await batch.commit();
        loadUsers("stall_owner"); // Refresh list
      };

      userTableBody.appendChild(userRow);
    });
  }

  // Show the table
  userTable.classList.remove("hidden");
}

// When clicking Edit, populate the form and switch to edit mode
async function editUser(userId) {
  const doc = await db.collection("users").doc(userId).get();
  const data = doc.data();
  document.getElementById("name").value = data.name;
  document.getElementById("email").value = data.email;
  // Do NOT clear the password field
  document.getElementById("role").value = data.role;
  editingUserId = userId;

  // Change button text to "Done"
  document.querySelector("#userForm button[type='submit']").textContent = "Done";
}

// Remove user
async function removeUser(userId) {
  if (confirm("Are you sure you want to remove this user?")) {
    try {
      // Get user data to check role and stallId
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      // If stall owner, delete their stall and update students
      if (userData.role === "stall_owner" && userData.stallId) {
        // Delete stall document
        await db.collection("stalls").doc(userData.stallId).delete();

        // Remove this stallId from all students' registeredStalls
        const studentsSnap = await db.collection("users").where("role", "==", "student").get();
        const batch = db.batch();
        studentsSnap.forEach(studentDoc => {
          const prev = studentDoc.data().registeredStalls || [];
          if (prev.includes(userData.stallId)) {
            const updated = prev.filter(id => id !== userData.stallId);
            batch.update(db.collection("users").doc(studentDoc.id), { registeredStalls: updated });
          }
        });
        await batch.commit();
      }

      // Delete the user document
      await db.collection("users").doc(userId).delete();
      alert("User removed successfully!");
      const role = document.getElementById("role").value;
      loadUsers(role); // Refresh user list
    } catch (error) {
      alert(error.message);
    }
  }
}

// Example function to update registeredStalls for a student
// Call this function from your admin panel when assigning stalls

async function assignStallsToStudent(studentUid, stallIdArray) {
  try {
    await db.collection("users").doc(studentUid).update({
      registeredStalls: stallIdArray
    });
    alert("Stalls assigned successfully!");
  } catch (error) {
    console.error("Error updating registeredStalls:", error);
    alert("Failed to assign stalls.");
  }
}

// Usage example:
// assignStallsToStudent("student_uid_here", ["stallId1", "stallId2"]);

// Load students and stalls for assignment UI
async function loadStudentsAndStalls() {
  const studentSelect = document.getElementById('studentSelect');
  const stallSelect = document.getElementById('stallSelect');
  studentSelect.innerHTML = '<option value="">Select Student</option>';
  stallSelect.innerHTML = '';

  // Load students
  const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
  studentsSnap.forEach(doc => {
    const data = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = data.name + ' (' + data.email + ')';
    studentSelect.appendChild(option);
  });

  // Load stalls
  const stallsSnap = await db.collection('stalls').get();
  stallsSnap.forEach(doc => {
    const data = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = data.name || doc.id;
    stallSelect.appendChild(option);
  });
}

// Assign selected stalls to selected student
document.getElementById('assignStallsBtn').onclick = async function() {
  const studentUid = document.getElementById('studentSelect').value;
  const stallOptions = document.getElementById('stallSelect').selectedOptions;
  const stallIds = Array.from(stallOptions).map(opt => opt.value);

  if (!studentUid || stallIds.length === 0) {
    alert('Please select a student and at least one stall.');
    return;
  }

  try {
    await db.collection('users').doc(studentUid).update({
      registeredStalls: stallIds
    });
    alert('Stalls assigned successfully!');
  } catch (e) {
    alert('Failed to assign stalls: ' + e.message);
  }
};

// Assign all stalls to every student user
async function assignAllStallsToAllStudents() {
  try {
    // Fetch all stall IDs
    const stallsSnap = await db.collection('stalls').get();
    const allStallIds = stallsSnap.docs.map(doc => doc.id);

    // Fetch all students
    const studentsSnap = await db.collection('users').where('role', '==', 'student').get();

    // Update each student with all stall IDs
    const batch = db.batch();
    studentsSnap.forEach(studentDoc => {
      const studentRef = db.collection('users').doc(studentDoc.id);
      batch.update(studentRef, { registeredStalls: allStallIds });
    });
    await batch.commit();

    alert('All students have been assigned all stalls!');
  } catch (e) {
    alert('Failed to assign stalls to all students: ' + e.message);
  }
}

// Example: Add a button to your admin panel HTML and link it to this function
// <button onclick="assignAllStallsToAllStudents()">Assign All Stalls to All Students</button>

// Load data when admin page loads
window.addEventListener('DOMContentLoaded', async () => {
  loadStudentsAndStalls();
  await assignAllStallsToAllStudents();
});

// Event listeners for buttons
document.getElementById("showStudentsButton").addEventListener("click", () => loadUsers("student"));
document.getElementById("showStallOwnersButton").addEventListener("click", () => loadUsers("stall_owner"));

// Back button event
const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.onclick = function() {
    window.location.href = "Admin_Main_Index.html";
  };
}