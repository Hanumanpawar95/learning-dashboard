document.addEventListener("DOMContentLoaded", () => {
  const centerDropdown = document.getElementById("viewCenterDropdown");
  const batchDropdown = document.getElementById("viewBatchDropdown");
  const reportOutput = document.getElementById("reportOutput");

  if (!centerDropdown || !batchDropdown || !reportOutput) return;

  // Step 1: Load metadata and group by center
  fetch("http://localhost:5000/get-reports-metadata")
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
      if (password !== "admin123") {
        alert("❌ Incorrect password. Access denied.");
        passwordModal.style.display = "none";
        return;
      }

      passwordModal.style.display = "none";

      // Fetch the report
      fetch(`http://localhost:5000/get-report?center=${center}&batch=${batch}`)
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

          const firstLearner = data[0];
          const courses = Object.keys(firstLearner.courses);

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

          reportOutput.innerHTML = "";
          reportOutput.appendChild(table);
        })
        .catch(err => {
          console.error("❌ Error fetching report:", err);
          reportOutput.innerHTML = "<p>❌ Failed to load report.</p>";
        });
    };
  };
});
