document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("csvFile");
  const batchNameInput = document.getElementById("batchName");
  const uploadedByInput = document.getElementById("uploadBy");
  const centerCodeInput = document.getElementById("centerCode");
  const tableBody = document.getElementById("table-body");
  const tableHeaderRow = document.getElementById("table-header-row");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!fileInput.files.length) {
        alert("❌ Please select a CSV file before uploading.");
        return;
      }

      const batchName = batchNameInput.value.trim();
      const uploadedBy = uploadedByInput.value.trim();
      const centerCode = centerCodeInput.value.trim();

      if (!centerCode || !batchName || !uploadedBy) {
        alert("⚠️ Please fill out Center Code, Batch Name, and Uploaded By fields.");
        return;
      }

      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      fetch("https://learning-dashboard-zlb0.onrender.com/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data || data.length === 0) {
            alert("⚠️ No data found in the uploaded CSV.");
            return;
          }

          sessionStorage.setItem("centerCode", centerCode);
          sessionStorage.setItem("batchName", batchName);
          sessionStorage.setItem("uploadedBy", uploadedBy);
          sessionStorage.setItem("uploadDate", new Date().toLocaleDateString());
          sessionStorage.setItem("reportData", JSON.stringify(data));

          window.location.href = "report.html";
        })
        .catch((error) => {
          console.error("❌ Upload Error:", error);
          alert("❌ Failed to upload the file. Please try again.");
        });
    });
  }

  function generateReport() {
    console.log("✅ Generating report...");

    const centerCode = sessionStorage.getItem("centerCode");
    const batchName = sessionStorage.getItem("batchName");
    const uploadedBy = sessionStorage.getItem("uploadedBy");
    const uploadDate = sessionStorage.getItem("uploadDate");
    const reportData = JSON.parse(sessionStorage.getItem("reportData"));

    if (!batchName || !uploadedBy || !reportData) {
      alert("⚠️ No report data found. Please upload a file first.");
      window.location.href = "index.html";
      return;
    }

    document.getElementById("centerCodeDisplay").textContent = centerCode;
    document.getElementById("batchTitle").textContent = `📌 Batch Name: ${batchName}`;
    document.getElementById("uploadedBy").textContent = uploadedBy;
    document.getElementById("uploadDate").textContent = uploadDate;

    tableHeaderRow.innerHTML = `<th>#</th><th>Learner Code</th><th>Learner Name</th>`;
    const courseNames = Object.keys(reportData[0].courses || {});
    courseNames.forEach(course => {
      tableHeaderRow.innerHTML += `
        <th>${course} Classroom</th>
        <th>${course} Lab</th>
        <th>${course} Sessions</th>
        <th>${course} Status</th>
      `;
    });
    tableHeaderRow.innerHTML += `<th>Overall Status</th><th>Comment</th>`;
    tableBody.innerHTML = "";

    reportData.forEach((learner, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${learner.code}</td>
        <td>${learner.name}</td>
      `;

      let isEligibleForAnyCourse = false;

      courseNames.forEach(course => {
        const courseData = learner.courses[course];
        const classroomMarks = courseData.classroomMarks ?? "";
        const labMarks = courseData.labMarks ?? "";
        const sessionCount = courseData.sessionCount ?? "";
        const eligible = courseData.eligible ?? "❌ Not Eligible";

        if (eligible.includes("✅")) isEligibleForAnyCourse = true;

        row.innerHTML += `
          <td>${classroomMarks}</td>
          <td>${labMarks}</td>
          <td>${sessionCount}</td>
          <td class="${eligible.includes("✅") ? "eligible" : "not-eligible"}">${eligible}</td>
        `;
      });

      row.innerHTML += `
        <td class="${isEligibleForAnyCourse ? 'eligible' : 'not-eligible'}">
          ${isEligibleForAnyCourse ? "✅ Eligible for at least one course" : "❌ Not Eligible for any course"}
        </td>
        <td><textarea class="comment-box" placeholder="Add comment..."></textarea></td>
      `;

      tableBody.appendChild(row);
    });

    const btnContainer = document.getElementById("button-container");
    if (btnContainer) {
      const submitBtn = document.createElement("button");
      submitBtn.textContent = "📝 Submit Report";
      submitBtn.className = "submit-report-btn";
      submitBtn.addEventListener("click", submitFinalReport);
      btnContainer.appendChild(submitBtn);
    } else {
      console.error("❌ 'button-container' not found in DOM.");
    }
  }

  function submitFinalReport() {
    console.log("📝 Submit report clicked!");

    const reportData = JSON.parse(sessionStorage.getItem("reportData")) || [];
    const comments = document.querySelectorAll(".comment-box");

    reportData.forEach((learner, i) => {
      learner.comment = comments[i].value.trim();
    });

    const payload = {
      centerCode: sessionStorage.getItem("centerCode"),
      batchName: sessionStorage.getItem("batchName"),
      uploadedBy: sessionStorage.getItem("uploadedBy"),
      uploadDate: sessionStorage.getItem("uploadDate"),
      data: reportData,
    };

    console.log("📦 Payload being sent:", payload);

    fetch("https://learning-dashboard-zlb0.onrender.com/save-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const response = await res.json();
          console.log("✅ Response received:", response);
          document.getElementById("button-container").innerHTML = `<p class="success-msg">✅ Report submitted successfully!</p>`;
          sessionStorage.clear();
        } else {
          const text = await res.text();
          console.error("❌ Server did not return JSON:", text);
          alert("❌ Server error: " + text);
        }
      })
      .catch((err) => {
        console.error("❌ Error saving report:", err);
        alert("❌ Failed to save report.");
      });
  }

  function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const centerCode = sessionStorage.getItem("centerCode");
    const batchName = document.getElementById("batchTitle").textContent;
    const uploadedBy = document.getElementById("uploadedBy").textContent;
    const uploadDate = document.getElementById("uploadDate").textContent;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [380, 210],
    });

    pdf.setFillColor(244, 246, 249);
    pdf.rect(0, 0, 380, 210, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(33, 33, 33);
    pdf.text(batchName, 14, 15);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Center Code: ${centerCode}`, 14, 21);
    pdf.text(`Uploaded By: ${uploadedBy}`, 14, 27);
    pdf.text(`Date: ${uploadDate}`, 14, 33);

    const table = document.getElementById("reportTable");
    const headers = [];
    const body = [];

    const headerCells = table.querySelectorAll("thead tr th");
    headerCells.forEach(th => headers.push(th.textContent.trim()));

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach(row => {
      const rowData = [];
      const cells = row.querySelectorAll("td");

      cells.forEach((td, i) => {
        let text = "";
        if (i === cells.length - 1) {
          const textarea = td.querySelector("textarea");
          text = textarea ? textarea.value.trim() : "";
        } else {
          text = td.textContent.trim();
          const isStatusColumn = headers[i]?.toLowerCase().includes("status");
          if (isStatusColumn) {
            const raw = text.toLowerCase();
            if (raw.includes("✔") || raw.includes("✓")) {
              text = "Eligible";
            } else if (raw.includes("✘") || raw.includes("✗") || raw.includes("not eligible")) {
              text = "Not Eligible";
            } else if (raw.includes("eligible") && !raw.includes("not")) {
              text = "Eligible";
            }
          }
        }

        const bgColor = td.classList.contains("eligible")
          ? [76, 175, 80]
          : td.classList.contains("not-eligible")
          ? [244, 67, 54]
          : [255, 255, 255];

        rowData.push({
          content: text,
          styles: {
            fillColor: bgColor,
            textColor: [0, 0, 0],
            fontSize: 8.5,
            halign: "center",
            valign: "middle",
          },
        });
      });

      body.push(rowData);
    });

    pdf.autoTable({
      startY: 38,
      head: [headers],
      body: body,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2,
        overflow: "linebreak",
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        [headers.length - 1]: { cellWidth: 50 },
      },
      theme: "grid",
    });

    pdf.save("Batch_Report.pdf");
  }

  if (window.location.pathname.includes("report.html")) {
    generateReport();
    const pdfBtn = document.getElementById("downloadPDF");
    if (pdfBtn) pdfBtn.addEventListener("click", downloadPDF);
  }

  const viewBtn = document.getElementById("viewReportsBtn");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      window.location.href = "view.html";
    });
  }
});
