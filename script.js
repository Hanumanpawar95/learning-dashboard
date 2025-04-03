document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("upload-form");
    const fileInput = document.getElementById("csvFile");
    const batchNameInput = document.getElementById("batchName");
    const uploadedByInput = document.getElementById("uploadBy");
    const tableBody = document.getElementById("table-body");
    const tableHeaderRow = document.getElementById("table-header-row");

    if (!form) {
        console.error("❌ Error: #upload-form not found!");
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!fileInput.files.length) {
            alert("❌ Please select a CSV file before uploading.");
            return;
        }

        const batchName = batchNameInput.value.trim();
        const uploadedBy = uploadedByInput.value.trim();

        if (!batchName || !uploadedBy) {
            alert("⚠️ Please enter Batch Name and Uploaded By.");
            return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        fetch("http://localhost:5000/upload", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                if (!data || data.length === 0) {
                    alert("⚠️ No data found in the uploaded CSV.");
                    return;
                }

                // Store data and redirect to report page
                sessionStorage.setItem("batchName", batchName);
                sessionStorage.setItem("uploadedBy", uploadedBy);
                sessionStorage.setItem("reportData", JSON.stringify(data));

                window.location.href = "report.html";
            })
            .catch((error) => {
                console.error("❌ Upload Error:", error);
                alert("❌ Failed to upload the file. Please try again.");
            });
    });

    function generateReport() {
        const storedData = sessionStorage.getItem("reportData");
        if (!storedData) {
            console.error("⚠️ No report data found.");
            return;
        }

        const learners = JSON.parse(storedData);
        tableBody.innerHTML = ""; // Clear existing rows

        if (learners.length === 0) {
            alert("⚠️ No data available to display.");
            return;
        }

        const courseNames = Object.keys(learners[0].courses || {}); // Fix: Handle undefined courses
        tableHeaderRow.innerHTML = `
            <th>#</th>
            <th>Learner Code</th>
            <th>Learner Name</th>
            ${courseNames
                .map(
                    (course) =>
                        `<th>${course} Classroom</th><th>${course} Lab</th><th>${course} Sessions</th><th>${course} Status</th>`
                )
                .join("")}
            <th>Overall Status</th>
        `;

        learners.forEach((learner, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${learner.code}</td>
                <td>${learner.name}</td>
            `;

            let isEligibleForAnyCourse = false;

            courseNames.forEach((course) => {
                const courseData = learner.courses[course] || {}; // Fix: Avoid errors if course data is missing
                const classroomMarks = courseData.classroomMarks || 0;
                const labMarks = courseData.labMarks || 0;
                const sessionCount = courseData.sessionCount || 0;
                const eligible = courseData.eligible || "❌ Not Eligible";

                row.innerHTML += `
                    <td>${classroomMarks} / 20</td>
                    <td>${labMarks} / 60</td>
                    <td>${sessionCount} / 60</td>
                    <td class="${eligible === '✅ Eligible' ? 'eligible badge' : 'not-eligible badge'}">${eligible}</td>
                `;

                if (eligible === "✅ Eligible") {
                    isEligibleForAnyCourse = true;
                }
            });

            row.innerHTML += `
                <td class="${isEligibleForAnyCourse ? 'eligible badge' : 'not-eligible badge'}">
                    ${isEligibleForAnyCourse ? "✅ Eligible for at least one course" : "❌ Not Eligible for any course"}
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    // Ensure the report is generated after navigating to report.html
    if (window.location.pathname.includes("report.html")) {
        generateReport();
    }
});
