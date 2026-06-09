document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("csvFile");
  const batchNameInput = document.getElementById("batchName");
  const uploadedByInput = document.getElementById("uploadBy");
  const centerCodeInput = document.getElementById("centerCode");
  const tableBody = document.getElementById("table-body");
  const tableHeaderRow = document.getElementById("table-header-row");

  // Upload Section Logic
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!fileInput.files.length) { alert("❌ Please select a CSV file."); return; }
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
      fetch("https://learning-dashboard-zlb0.onrender.com/upload", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem("centerCode", centerCodeInput.value);
          sessionStorage.setItem("batchName", batchNameInput.value);
          sessionStorage.setItem("uploadedBy", uploadedByInput.value);
          sessionStorage.setItem("uploadDate", new Date().toLocaleDateString());
          sessionStorage.setItem("reportData", JSON.stringify(data));
          window.location.href = "report.html";
        })
        .catch(err => alert("❌ Upload failed!"));
    });
  }

  // Report Generation Logic
  function generateReport() {
    const reportData = JSON.parse(sessionStorage.getItem("reportData"));
    if (!reportData) return;

    document.getElementById("centerCodeDisplay").textContent = sessionStorage.getItem("centerCode");
    document.getElementById("batchTitle").textContent = `📌 Batch Name: ${sessionStorage.getItem("batchName")}`;
    document.getElementById("uploadedBy").textContent = sessionStorage.getItem("uploadedBy");
    document.getElementById("uploadDate").textContent = sessionStorage.getItem("uploadDate");

    const courseNames = Object.keys(reportData[0].courses || {});
    tableHeaderRow.innerHTML = `<th>#</th><th>Learner Code</th><th>Learner Name</th>`;
    courseNames.forEach(c => tableHeaderRow.innerHTML += `<th>${c} Classroom</th><th>${c} Lab</th><th>${c} Sessions</th><th>${c} Status</th>`);
    tableHeaderRow.innerHTML += `<th>Overall Status</th><th>Comment</th>`;

    // Dashboard & Table Rendering
    tableBody.innerHTML = "";
    reportData.forEach((learner, index) => {
      const row = document.createElement("tr");
      let rowHTML = `<td>${index + 1}</td><td>${learner.code}</td><td>${learner.name}</td>`;
      courseNames.forEach(c => {
        const d = learner.courses[c];
        rowHTML += `<td>${d.classroomMarks}</td><td>${d.labMarks}</td><td>${d.sessionCount}</td><td>${d.eligible}</td>`;
      });
      rowHTML += `<td>${learner.eligible}</td><td><textarea class="comment-box" style="width:100%; height:40px;">${learner.comment || ""}</textarea></td>`;
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });
    
    // Submit Button Implementation
    const btnContainer = document.getElementById("button-container");
    const submitBtn = document.createElement("button");
    submitBtn.textContent = "📝 Submit Report";
    submitBtn.className = "submit-report-btn";
    submitBtn.onclick = submitFinalReport;
    btnContainer.appendChild(submitBtn);
  }

  // Comment Save Logic
  function submitFinalReport() {
    const reportData = JSON.parse(sessionStorage.getItem("reportData"));
    const comments = document.querySelectorAll(".comment-box");
    reportData.forEach((l, i) => { l.comment = comments[i].value; });
    
    fetch("https://learning-dashboard-zlb0.onrender.com/save-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerCode: sessionStorage.getItem("centerCode"),
        batchName: sessionStorage.getItem("batchName"),
        data: reportData
      })
    })
    .then(res => res.json())
    .then(data => alert("✅ Report Saved Successfully!"))
    .catch(err => alert("❌ Save failed."));
  }

  // PDF Generation with Encoding Fix
  function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [380, 210] });
    const table = document.getElementById("reportTable");
    const body = [];
    table.querySelectorAll("tbody tr").forEach(row => {
      const rowData = [];
      row.querySelectorAll("td").forEach((td, i) => {
        let text = (i === row.cells.length - 1) ? td.querySelector("textarea").value : td.textContent;
        // Encoding fix: Replace symbols with simple text
        text = text.replace(/✅/g, "Eligible").replace(/❌/g, "Not Eligible").trim();
        rowData.push(text);
      });
      body.push(rowData);
    });
    pdf.autoTable({ html: '#reportTable', theme: 'grid', styles: { fontSize: 8 } });
    pdf.save("Batch_Report.pdf");
  }

  // PDF Button Event
  const pdfBtn = document.getElementById("downloadPDF");
  if (pdfBtn) pdfBtn.addEventListener("click", downloadPDF);

  // Global Function for Dashboard Modal
  window.showEligibleLearners = function(course) {
    const learners = window.eligibleLearners?.[course] || [];
    const modal = document.getElementById("eligibleModal");
    if(modal) {
        document.getElementById("eligibleList").innerHTML = learners.map(x => `<tr><td>${x.code}</td><td>${x.name}</td></tr>`).join("");
        modal.style.display = "block";
    }
  };

  if (window.location.pathname.includes("report.html")) {
    generateReport();
  }
});
