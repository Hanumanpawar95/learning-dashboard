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
    const eligibleCounts = {};
    const eligibleLearners = {};
    courseNames.forEach(course => {
      eligibleCounts[course] = 0;
      eligibleLearners[course] = [];
    });
    let totalEligible = 0;
    reportData.forEach(learner => {
      let anyEligible = false;
      courseNames.forEach(course => {
        const courseData = learner.courses[course];
        if (courseData && courseData.eligible && courseData.eligible.includes("✅")) {
          eligibleCounts[course]++;
          // Updated to pass session count safely down to modal builder
          eligibleLearners[course].push({ 
            code: learner.code, 
            name: learner.name, 
            sessions: courseData.sessionCount || 0 
          });
          anyEligible = true;
        }
      });
      if (anyEligible) totalEligible++;
    });

    window.eligibleLearners = eligibleLearners;
    courseNames.forEach((course) => {
      tableHeaderRow.innerHTML += `<th>${course} Classroom</th><th>${course} Lab</th><th>${course} Sessions</th><th>${course} Status</th>`;
    });
    tableHeaderRow.innerHTML += `<th>Overall Status</th><th>Comment</th>`;
    tableBody.innerHTML = "";

    const dashboard = document.getElementById("eligibilityDashboard");
    if (dashboard) {
      let dashboardHTML = `<div style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center; margin:20px 0;">`;
      const cardColors = {
        "BS-CIT": "linear-gradient(135deg,#0f8a3b,#2ecc71)",
        "BS-CLS": "linear-gradient(135deg,#7b1fa2,#ab47bc)",
        "BS-CSS": "linear-gradient(135deg,#c2185b,#ff4081)"
      };
      courseNames.forEach(course => {
        const bg = cardColors[course] || "linear-gradient(135deg,#455a64,#78909c)";
        dashboardHTML += `
          <div onclick="showEligibleLearners('${course}')" style="cursor:pointer; background:${bg}; color:white; padding:20px; min-width:220px; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,.25); text-align:center; transition:.3s;">
            <h3 style="margin:0; font-size:22px; font-weight:bold;">${course}</h3>
            <div style="font-size:42px; font-weight:bold; margin-top:10px;">${eligibleCounts[course]}</div>
            <div style="font-size:14px; opacity:.9;">Eligible Learners</div>
          </div>`;
      });
      dashboardHTML += `
        <div style="background:linear-gradient(135deg,#1565c0,#42a5f5); color:white; padding:20px; min-width:220px; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,.25); text-align:center;">
          <h3 style="margin:0; font-size:22px; font-weight:bold;">Total Eligible</h3>
          <div style="font-size:42px; font-weight:bold; margin-top:10px; color:white;">${totalEligible}</div>
          <div style="font-size:14px; opacity:.9;">Eligible In Any Course</div>
        </div></div>`;
      dashboard.innerHTML = dashboardHTML;
    }

    reportData.forEach((learner, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${index + 1}</td><td>${learner.code}</td><td>${learner.name}</td>`;
      let isEligibleForAnyCourse = false;
      courseNames.forEach((course) => {
        const courseData = learner.courses[course];
        const eligible = courseData.eligible ?? "❌ Not Eligible";
        if (eligible.includes("✅")) isEligibleForAnyCourse = true;
        row.innerHTML += `<td>${courseData.classroomMarks ?? ""}</td><td>${courseData.labMarks ?? ""}</td><td>${courseData.sessionCount ?? ""}</td><td class="${eligible.includes("✅") ? "eligible" : "not-eligible"}">${eligible}</td>`;
      });
      row.innerHTML += `<td class="${isEligibleForAnyCourse ? 'eligible' : 'not-eligible'}">${isEligibleForAnyCourse ? "✅ Eligible for at least one course" : "❌ Not Eligible for any course"}</td><td><textarea class="comment-box" placeholder="Add comment..."></textarea></td>`;
      tableBody.appendChild(row);
    });

    const btnContainer = document.getElementById("button-container");
    if (btnContainer) {
      const submitBtn = document.createElement("button");
      submitBtn.textContent = "📝 Submit Report";
      submitBtn.className = "submit-report-btn";
      submitBtn.addEventListener("click", submitFinalReport);
      btnContainer.appendChild(submitBtn);
    }
  }

  function submitFinalReport() {
    const reportData = JSON.parse(sessionStorage.getItem("reportData")) || [];
    const comments = document.querySelectorAll(".comment-box");
    reportData.forEach((learner, i) => { learner.comment = comments[i].value.trim(); });
    const payload = {
      centerCode: sessionStorage.getItem("centerCode"),
      batchName: sessionStorage.getItem("batchName"),
      uploadedBy: sessionStorage.getItem("uploadedBy"),
      uploadDate: sessionStorage.getItem("uploadDate"),
      data: reportData,
    };
    fetch("https://learning-dashboard-zlb0.onrender.com/save-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          alert("✅ " + data.message + "\n📄 File ID: " + data.fileId);
          sessionStorage.clear();
        } else {
          alert("❌ Server error: " + (data.message || "Unknown error"));
        }
      })
      .catch((err) => { console.error("❌ Error saving report:", err); alert("❌ Failed to save report."); });
  }

  function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const centerCode = sessionStorage.getItem("centerCode");
    const batchName = document.getElementById("batchTitle").textContent;
    const uploadedBy = document.getElementById("uploadedBy").textContent;
    const uploadDate = document.getElementById("uploadDate").textContent;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [380, 210] });
    pdf.setFillColor(244, 246, 249);
    pdf.rect(0, 0, 380, 210, "F");
    pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(33, 33, 33);
    pdf.text(batchName, 14, 15);
    pdf.setFont("helvetica", "normal").setFontSize(11);
    pdf.text(`Center Code: ${centerCode}`, 14, 21);
    pdf.text(`Uploaded By: ${uploadedBy}`, 14, 27);
    pdf.text(`Date: ${uploadDate}`, 14, 33);
    const table = document.getElementById("reportTable");
    const headers = [];
    const body = [];
    table.querySelectorAll("thead tr th").forEach((th) => headers.push(th.textContent.trim()));
    table.querySelectorAll("tbody tr").forEach((row) => {
      const rowData = [];
      const cells = row.querySelectorAll("td");
      cells.forEach((td, i) => {
        let text = "";
        if (i === cells.length - 1) {
          const textarea = td.querySelector("textarea");
          text = textarea ? textarea.value.trim() : "";
        } else {
          text = td.textContent.trim();
          const isStatus = headers[i]?.toLowerCase().includes("status");
          if (isStatus) {
            const raw = text.toLowerCase();
            if (raw.includes("✔") || raw.includes("✓")) text = "Eligible";
            else if (raw.includes("✘") || raw.includes("✗") || raw.includes("not eligible")) text = "Not Eligible";
          }
        }
        const bgColor = td.classList.contains("eligible") ? [76, 175, 80] : td.classList.contains("not-eligible") ? [244, 67, 54] : [255, 255, 255];
        rowData.push({ content: text, styles: { fillColor: bgColor, textColor: [0, 0, 0], fontSize: 8.5, halign: "center", valign: "middle" } });
      });
      body.push(rowData);
    });
    pdf.autoTable({ startY: 38, head: [headers], body, styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 }, headStyles: { fillColor: [0, 150, 136], textColor: [255, 255, 255], fontSize: 9 }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 }, [headers.length - 1]: { cellWidth: 50 } }, theme: "grid" });
    pdf.save("Batch_Report.pdf");
  }

  window.showEligibleLearners = function(course) {
    const learners = window.eligibleLearners?.[course] || [];
    const modal = document.getElementById("eligibleModal");
    const title = document.getElementById("eligibleTitle");
    const list = document.getElementById("eligibleList");
    if (!modal || !title || !list) return;
    title.innerHTML = `<div style="background:linear-gradient(135deg,#4CAF50,#2E7D32); color:white; padding:15px; border-radius:10px; text-align:center; font-size:22px; font-weight:bold; margin-bottom:10px;">${course} Eligible Learners (${learners.length})</div>`;
    
    // Updated template parsing to include third sessions column
    list.innerHTML = learners.map((x, index) => `
      <tr>
        <td style="padding:10px; border:1px solid #ddd; background:${index % 2 ? '#f8f9fa' : '#ffffff'}; font-weight:bold;">${x.code}</td>
        <td style="padding:10px; border:1px solid #ddd; background:${index % 2 ? '#f8f9fa' : '#ffffff'}; text-align:left;">${x.name}</td>
        <td style="padding:10px; border:1px solid #ddd; background:${index % 2 ? '#f8f9fa' : '#ffffff'}; text-align:center;">Completed Session : ${x.sessions}</td>
      </tr>
    `).join("");
    modal.style.display = "block";
  };

  if (window.location.pathname.includes("report.html")) {
    generateReport();
    const pdfBtn = document.getElementById("downloadPDF");
    if (pdfBtn) pdfBtn.addEventListener("click", downloadPDF);
  }
  const viewBtn = document.getElementById("viewReportsBtn");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => { window.location.href = "view.html"; });
  }
});
