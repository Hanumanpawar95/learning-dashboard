document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("upload-form");
    const fileInput = document.getElementById("csvFile");
    const batchNameInput = document.getElementById("batchName");
    const uploadedByInput = document.getElementById("uploadBy");
    const reportHeader = document.getElementById("report-header");
    const batchTitle = document.getElementById("batchTitle");
    const uploadedByText = document.getElementById("uploadedBy");
    const uploadDateText = document.getElementById("uploadDate");
    const tableBody = document.getElementById("table-body");

    const uploadSection = document.getElementById("upload-section");

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

                // ✅ Hide the form after successful upload
                uploadSection.style.display = "none";

                // ✅ Show the report
                reportHeader.style.display = "block";
                batchTitle.textContent = `📌 Batch Name: ${batchName}`;
                uploadedByText.textContent = uploadedBy;
                uploadDateText.textContent = new Date().toLocaleDateString();

                displayResults(data);
                attachButtonEvents();
            })
            .catch((error) => {
                console.error("❌ Upload Error:", error);
                alert("❌ Failed to upload the file. Please try again.");
            });
    });

    function displayResults(learners) {
        tableBody.innerHTML = "";

        learners.forEach((learner, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${learner.code}</td>
                <td>${learner.name}</td>

                ${createCourseCells(learner, "BS-CIT")}
                ${createCourseCells(learner, "BS-CLS")}
                ${createCourseCells(learner, "BS-CSS")}

                <td class="${getStatusClass(learner.eligible)}">${learner.eligible}</td>
            `;

            tableBody.appendChild(row);
        });
    }

    function createCourseCells(learner, course) {
        if (!learner.courses[course]) {
            return `<td colspan="4">N/A</td>`;
        }

        const { classroomMarks, labMarks, sessionCount, eligible } = learner.courses[course];

        return `
            <td>${classroomMarks}</td>
            <td>${labMarks}</td>
            <td>${sessionCount}</td>
            <td class="${getStatusClass(eligible)}">${eligible}</td>
        `;
    }

    function getStatusClass(status) {
        return status === "✅ Eligible" ? "eligible badge" : "not-eligible badge";
    }

    function printReport() {
        window.print();
    }

    function downloadCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        document.querySelectorAll("#report-table tr").forEach(row => {
            csvContent += Array.from(row.cells).map(cell => `"${cell.innerText}"`).join(",") + "\n";
        });

        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.href = encodedUri;
        link.download = "learner_report.csv";
        link.click();
    }

    function attachButtonEvents() {
        document.getElementById("print-report").addEventListener("click", printReport);
        document.getElementById("download-csv").addEventListener("click", downloadCSV);
    }
});
