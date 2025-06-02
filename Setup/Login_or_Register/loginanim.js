$(document).ready(function () {
    $('.login-show').addClass('show-log-panel');
});

// Check authentication state and redirect if already logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userId = user.uid;

        try {
            // Fetch user role from Firestore
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();

                // Redirect based on role
                if (userData.role === "student") {
                    console.log("Redirecting to Student Dashboard...");
                    window.location.href = `../Student_Dashboard/Stall_Selection_Index.html?userId=${userId}`;
                } else if (userData.role === "stall_owner") {
                    console.log("Redirecting to Stall Owner Dashboard...");
                    window.location.href = `../Stall_Owner_Dashboard/Stall_Screen_Index.html?stallId=${userData.stallId}`;
                } else {
                    console.log("Invalid user role.");
                }
            } else {
                console.log("User document not found.");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }
});

// Login form submission
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("errorMessage");

    try {
        // Authenticate user
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;

        // Fetch user role from Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();

            // Redirect based on role
            if (userData.role === "student") {
                console.log("Redirecting to Student Dashboard...");
                window.location.href = `../Student_Dashboard/Stall_Selection_Index.html?userId=${userId}`;
            } else if (userData.role === "stall_owner") {
                console.log("Redirecting to Stall Owner Dashboard...");
                window.location.href = `../Stall_Owner_Dashboard/Stall_Screen_Index.html?stallId=${userData.stallId}`;
            } else {
                console.log("Invalid user role.");
                errorMessage.textContent = "Invalid user role.";
            }
        } else {
            errorMessage.textContent = "User not found.";
        }
    } catch (error) {
        console.error("Error during login:", error);

        // Set custom message for invalid credentials
        if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
            errorMessage.textContent = "Incorrect email or password.";
        } else {
            errorMessage.textContent = error.message;
        }

        // Add red border to input fields
        document.getElementById("email").style.border = "2px solid red";
        document.getElementById("password").style.border = "2px solid red";
    }
});

// Remove red border when user starts typing
["email", "password"].forEach(id => {
    document.getElementById(id).addEventListener("input", function () {
        this.style.border = "";
    });
});