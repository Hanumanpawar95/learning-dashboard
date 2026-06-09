document.addEventListener("DOMContentLoaded", () => {
  const centerDropdown = document.getElementById("viewCenterDropdown");
  const batchDropdown = document.getElementById("viewBatchDropdown");
  const reportOutput = document.getElementById("reportOutput");

  if (!centerDropdown || !batchDropdown || !reportOutput) return;

  // Step 1: Load metadata and group by center
  fetch("https://learning-dashboard-zlb0.onrender.com/get-reports-metadata")
    .then(res => res.json())
    .then(metadata => {
      const grouped = {};

      metadata.forEach(({ centerCode, batchName }) => {
        if (!grouped[centerCode]) grouped[centerCode] = [];
        grouped[centerCode].push(batchName);
      });

      Object.keys(grouped).forEach(center => {
        const option = document.createElement("option");
        option.value = center;
        option.textContent = center;
        centerDropdown.appendChild(option);
      });

      centerDropdown.addEventListener("change", () => {
        const selectedCenter = centerDropdown.value;
        batchDropdown.innerHTML = '<option value="">--Select Batch--</option>';

        if (grouped[selectedCenter]) {
          grouped[selectedCenter].forEach(batch => {
            const option = document.createElement("option");
            option.value = batch;
            option.textContent = batch;
            batchDropdown.appendChild(option);
          });
        }
      });
    })
    .catch(err => {
      console.error("❌ Error loading metadata:", err);
      alert("Failed to load report metadata.");
    });

  // Add Password Modal to the DOM (initially hidden)
  const modalHTML = `
    <div id="passwordModal" style="display: none;">
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: #fff; padding: 25px 30px; border-radius: 8px; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.3);">
          <h3>🔒 Enter Report Password</h3>
          <input id="reportPassword" type="password" placeholder="Enter password" style="padding:8px 10px; width:100%; margin:15px 0; font-size:16px;" />
          <div>
            <button id="submitPassword" style="padding:8px 18px;">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const passwordModal = document.getElementById("passwordModal");
  const passwordInput = document.getElementById("reportPassword");
  const submitPasswordBtn = document.getElementById("submitPassword");

  // Step 2: View Report with Modal Password Prompt
  window.viewReport = function () {
    const center = centerDropdown.value;
    const batch = batchDropdown.value;

    if (!center || !batch) {
      alert("⚠️ Please select both Center and Batch.");
      return;
    }

    // Show password modal
    passwordModal.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();

    submitPasswordBtn.onclick = () => {
      const password = passwordInput.value;
      if (password !== "Mkcl4311") {
        alert("❌ Incorrect password. Access denied.");
        passwordModal.style.display = "none";
        return;
      }

      passwordModal.style.display = "none";

      // Fetch the report
      fetch(`https://learning-dashboard-zlb0.onrender.com/get-report?center=${center}&batch=${batch}`)
        .then(res => {
          if (!res.ok) throw new Error("Report not found");
          return res.json();
        })
        .then(report => {
          const data = report.data;
          if (!Array.isArray(data) || data.length === 0) {
            reportOutput.innerHTML = "<p>⚠️ No data found in this report.</p>";
            return;
          }
		  const courses = Object.keys(data[0].courses || {});

// Dashboard Calculation
const eligibleCounts = {};
const eligibleLearners = {};

courses.forEach(course => {
  eligibleCounts[course] = 0;
  eligibleLearners[course] = [];
});

let totalEligible = 0;

data.forEach(learner => {

  let anyEligible = false;

  courses.forEach(course => {

    const courseData = learner.courses[course];

    if (
  courseData &&
  courseData.eligible &&
  (
    courseData.eligible.includes("✅") ||
    courseData.eligible.includes("Eligible")
  )
) {

      eligibleCounts[course]++;

      eligibleLearners[course].push({
        code: learner.code,
        name: learner.name
      });

      anyEligible = true;
    }

  });

  if (anyEligible) {
    totalEligible++;
  }

});

window.eligibleLearners = eligibleLearners;
console.log("eligibleLearners =", eligibleLearners);
let dashboardHTML = `
<div style="
display:flex;
gap:15px;
flex-wrap:wrap;
justify-content:center;
margin:20px 0;
">
`;

const cardColors = {
  "BS-CIT":"linear-gradient(135deg,#0f8a3b,#2ecc71)",
  "BS-CLS":"linear-gradient(135deg,#7b1fa2,#ab47bc)",
  "BS-CSS":"linear-gradient(135deg,#c2185b,#ff4081)"
};

courses.forEach(course => {

const bg =
cardColors[course] ||
"linear-gradient(135deg,#455a64,#78909c)";

dashboardHTML += `
<div
onclick="window.showEligibleLearners('${course}')"
style="
cursor:pointer;
background:${bg};
color:white;
padding:20px;
min-width:220px;
border-radius:12px;
box-shadow:0 4px 10px rgba(0,0,0,.25);
text-align:center;
">
<h3 style="margin:0;">
${course}
</h3>

<div style="
font-size:42px;
font-weight:bold;
margin-top:10px;
">
${eligibleCounts[course]}
</div>

<div style="
font-size:14px;
opacity:.9;
">
Eligible Learners
</div>

</div>
`;
});

dashboardHTML += `
<div style="
background:linear-gradient(135deg,#1565c0,#42a5f5);
color:white;
padding:20px;
min-width:220px;
border-radius:12px;
box-shadow:0 4px 10px rgba(0,0,0,.25);
text-align:center;
">

<h3 style="margin:0;">
Total Eligible
</h3>

<div style="
font-size:42px;
font-weight:bold;
margin-top:10px;
">
${totalEligible}
</div>

<div style="
font-size:14px;
opacity:.9;
">
Eligible In Any Course
</div>

</div>
`;

dashboardHTML += `</div>`;

          // 🟢 Format Upload Date safely
          let uploadedDate = "Unknown";
          if (report.uploadDate) {
            const date = new Date(report.uploadDate);
            uploadedDate = isNaN(date.getTime())
              ? report.uploadDate
              : date.toLocaleDateString("en-IN");
          }

          // 🟡 Report Header Info
          const reportHeader = `
            <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border: 1px solid #ccc;">
              <strong>Batch Name:</strong> ${report.batchName || batch}<br>
              <strong>Center Code:</strong> ${report.centerCode || center}<br>
              <strong>Uploaded By:</strong> ${report.uploadedBy || "Unknown"}<br>
              <strong>Date:</strong> ${uploadedDate}
            </div>
          `;

          const table = document.createElement("table");
          table.border = "1";
          table.cellPadding = "8";
          table.style.width = "100%";
          table.style.borderCollapse = "collapse";

          // Table header
          const headerRow = document.createElement("tr");
          headerRow.innerHTML = `
            <th>#</th>
            <th>Learner Code</th>
            <th>Learner Name</th>
          `;

		  

          courses.forEach(course => {
            headerRow.innerHTML += `
              <th>${course} Classroom</th>
              <th>${course} Lab</th>
              <th>${course} Sessions</th>
              <th>${course} Eligibility</th>
            `;
          });

          headerRow.innerHTML += `
            <th>Overall Eligibility</th>
            <th>Comment</th>
          `;
          table.appendChild(headerRow);

          // Table body
          data.forEach((learner, i) => {
            const row = document.createElement("tr");
            let rowHTML = `
              <td>${i + 1}</td>
              <td>${learner.code}</td>
              <td>${learner.name}</td>
            `;

            courses.forEach(course => {
              const c = learner.courses[course];
              rowHTML += `
                <td>${c.classroomMarks}</td>
                <td>${c.labMarks}</td>
                <td>${c.sessionCount}</td>
                <td>${c.eligible}</td>
              `;
            });

            rowHTML += `
              <td>${learner.eligible}</td>
              <td>${learner.comment || "-"}</td>
            `;

            row.innerHTML = rowHTML;
            table.appendChild(row);
          });

          reportOutput.innerHTML =
          reportHeader + dashboardHTML;

          reportOutput.appendChild(table);
        })
        .catch(err => {
          console.error("❌ Error fetching report:", err);
          reportOutput.innerHTML = "<p>❌ Failed to load report.</p>";
        });
    };
  };
});
window.showEligibleLearners = function(course){

const learners =
window.eligibleLearners?.[course] || [];

const modal =
document.getElementById("eligibleModal");

const title =
document.getElementById("eligibleTitle");

const list =
document.getElementById("eligibleList");

if (!modal || !title || !list) {
  console.log("Modal elements missing");
  return;
}

title.innerHTML = `
<div style="
background:linear-gradient(135deg,#4CAF50,#2E7D32);
color:white;
padding:15px;
border-radius:10px;
text-align:center;
font-size:22px;
font-weight:bold;
margin-bottom:10px;
">
${course} Eligible Learners (${learners.length})
</div>
`;

list.innerHTML =
learners.map((x,index) => `
<tr>

<td style="
padding:10px;
border:1px solid #ddd;
background:${index % 2 ? '#f8f9fa' : '#ffffff'};
font-weight:bold;
">
${x.code}
</td>

<td style="
padding:10px;
border:1px solid #ddd;
background:${index % 2 ? '#f8f9fa' : '#ffffff'};
text-align:left;
">
${x.name}
</td>

</tr>
`).join("");

modal.style.display = "block";

};