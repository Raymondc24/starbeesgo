document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const stallId = urlParams.get("stallId");
  const dbRef = db.collection("transactions").where("stallId", "==", stallId);

  const paymentSelect = document.getElementById("filterPayment");
  const foodTypeSelect = document.getElementById("filterFoodType");
  const foodNameSelect = document.getElementById("filterFoodName");
  const tableBody = document.querySelector("#summaryTable tbody");
  const totalAmountCell = document.getElementById("totalAmount");
  let allOrders = [];
  let allFoodTypes = [];
  let currentSort = { key: "orderDate", asc: true };
  let lastFilteredRows = [];
  
  // Add these variables to track earliest and latest transaction dates
  let minTransactionDate = null;
  let maxTransactionDate = null;
  
  // Add elements for error messages
  const yearError = document.createElement("div");
  yearError.className = "validation-error";
  yearError.style.color = "red";
  yearError.style.fontSize = "12px";
  yearError.style.marginTop = "4px";
  yearError.style.display = "none";
  
  const monthError = document.createElement("div");
  monthError.className = "validation-error";
  monthError.style.color = "red";
  monthError.style.fontSize = "12px";
  monthError.style.marginTop = "4px";
  monthError.style.display = "none";
  
  // Get input elements
  const yearInput = document.getElementById("filterYear");
  const monthInput = document.getElementById("filterMonth");
  const startDateInput = document.getElementById("filterStartDate");
  const endDateInput = document.getElementById("filterEndDate");
  
  // Wrap inputs in filter columns if they aren't already
  function wrapInputInFilterCol(input) {
    // Check if input is already wrapped in filter-col
    if (!input.parentNode.classList.contains('filter-col')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'filter-col';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      return wrapper;
    }
    return input.parentNode;
  }

  // Wrap inputs and append error elements to the filter columns
  const yearCol = wrapInputInFilterCol(yearInput);
  const monthCol = wrapInputInFilterCol(monthInput);
  yearCol.appendChild(yearError);
  monthCol.appendChild(monthError);

  // Populate payment methods
  db.collection("adminPaymentMethods").get().then(snap => {
    snap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().name;
      opt.textContent = doc.data().name;
      paymentSelect.appendChild(opt);
    });
  });

  // Fetch all orders for this stall
  async function fetchOrders() {
    const snap = await dbRef.get();
    allOrders = [];
    let foodTypesSet = new Set();
    let allDates = [];
    
    snap.forEach(doc => {
      const data = doc.data();
      (data.items || []).forEach(item => {
        if (item.category) foodTypesSet.add(item.category);
      });
      allOrders.push({
        ...data,
        docId: doc.id
      });
      
      // Collect all transaction dates
      if (data.orderDate) {
        allDates.push(data.orderDate);
      }
    });
    
    // Find min and max dates from transactions
    if (allDates.length > 0) {
      minTransactionDate = allDates.reduce((min, date) => 
        date < min ? date : min, allDates[0]);
      maxTransactionDate = allDates.reduce((max, date) => 
        date > max ? date : max, allDates[0]);
        
      // Set min and max attributes on date inputs
      startDateInput.setAttribute("min", minTransactionDate);
      startDateInput.setAttribute("max", maxTransactionDate);
      endDateInput.setAttribute("min", minTransactionDate);
      endDateInput.setAttribute("max", maxTransactionDate);
      
      // Extract min and max years and months for validation
      const minYear = minTransactionDate.substring(0, 4);
      const maxYear = maxTransactionDate.substring(0, 4);
      const minMonth = minTransactionDate.substring(5, 7);
      const maxMonth = maxTransactionDate.substring(5, 7);
      
      // Add event listeners for year and month validation
      yearInput.addEventListener("input", function() {
        const value = this.value;
        if (value && (value < minYear || value > maxYear)) {
          yearError.textContent = `Year must be between ${minYear} and ${maxYear}`;
          yearError.style.display = "block";
          this.style.borderColor = "red";
        } else {
          yearError.style.display = "none";
          this.style.borderColor = "";
        }
      });
      
      monthInput.addEventListener("input", function() {
        const value = this.value;
        const selectedYear = yearInput.value;
        
        if (value) {
          let isInvalid = false;
          let errorMsg = "";
          
          // Convert to number for proper comparison
          const numValue = parseInt(value, 10);
          
          if (numValue < 1 || numValue > 12) {
            isInvalid = true;
            errorMsg = "Month must be between 1 and 12";
          } else if (selectedYear == minYear && numValue < parseInt(minMonth, 10)) {
            isInvalid = true;
            errorMsg = `For ${minYear}, month must be at least ${parseInt(minMonth, 10)}`;
          } else if (selectedYear == maxYear && numValue > parseInt(maxMonth, 10)) {
            isInvalid = true;
            errorMsg = `For ${maxYear}, month must be at most ${parseInt(maxMonth, 10)}`;
          }
          
          if (isInvalid) {
            monthError.textContent = errorMsg;
            monthError.style.display = "block";
            this.style.borderColor = "red";
          } else {
            monthError.style.display = "none";
            this.style.borderColor = "";
          }
        } else {
          monthError.style.display = "none";
          this.style.borderColor = "";
        }
      });
    }
    
    allFoodTypes = Array.from(foodTypesSet);
    renderFoodTypeOptions();
    const allRows = flattenOrders(allOrders);
    lastFilteredRows = allRows;
    
    // Only show today's orders by default
    filterOrders();
  }

  // Flatten orders: one row per food item
  function flattenOrders(orders) {
    let rows = [];
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        rows.push({
          orderId: order.orderId,
          orderDate: order.orderDate || "",
          foodType: item.category || "",
          foodName: item.name || "",
          quantity: item.quantity || 0,
          price: item.price || 0,
          amount: order.amount || 0,
          paymentMethod: order.paymentMethod || ""
        });
      });
    });
    return rows;
  }

  // Populate food type options
  function renderFoodTypeOptions() {
    foodTypeSelect.innerHTML = `<option value="">All</option>`;
    allFoodTypes.forEach(type => {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      foodTypeSelect.appendChild(opt);
    });
  }

  // Populate food name options based on selected food type
  function renderFoodNameOptions(selectedType) {
    foodNameSelect.innerHTML = `<option value="">All</option>`;
    let namesSet = new Set();
    allOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (item.category === selectedType) {
          namesSet.add(item.name);
        }
      });
    });
    Array.from(namesSet).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      foodNameSelect.appendChild(opt);
    });
  }

  // Filtering logic
  function filterOrders() {
    let filtered = flattenOrders(allOrders);
    const year = document.getElementById("filterYear").value;
    const month = document.getElementById("filterMonth").value;
    const payment = paymentSelect.value;
    const foodType = foodTypeSelect.value;
    const foodName = foodNameSelect.value;
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;

    filtered = filtered.filter(row => {
      let match = true;
      if (year) match = match && row.orderDate.startsWith(year);
      if (month) match = match && row.orderDate.slice(5,7) === month.padStart(2, "0");
      
      // Date range filter (updated to ensure default today filter)
      if (startDate && endDate) {
        match = match && (row.orderDate >= startDate && row.orderDate <= endDate);
      } else if (startDate) {
        match = match && (row.orderDate === startDate);
      } else if (!startDate && !endDate) {
        // Default: show only today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        match = match && (row.orderDate === todayStr);
      }
      
      if (payment) match = match && row.paymentMethod === payment;
      if (foodType) match = match && row.foodType === foodType;
      if (foodName) match = match && row.foodName === foodName;
      return match;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aVal, bVal;
      if (currentSort.key === "totalPrice") {
        aVal = Number(a.price) * Number(a.quantity);
        bVal = Number(b.price) * Number(b.quantity);
      } else {
        aVal = a[currentSort.key];
        bVal = b[currentSort.key];
      }
      if (aVal < bVal) return currentSort.asc ? -1 : 1;
      if (aVal > bVal) return currentSort.asc ? 1 : -1;
      return 0;
    });

    lastFilteredRows = filtered;
    renderTable(filtered);
  }

  function shouldMerge() {
    // Columns that require merging
    return ["orderId", "orderDate", "amount", "paymentMethod"].includes(currentSort.key);
  }

  // Render table
  function renderTable(rows) {
    tableBody.innerHTML = "";
    let total = 0;

    // Group rows by orderId + orderDate
    const groups = {};
    rows.forEach((row, idx) => {
      const key = `${row.orderId}_${row.orderDate}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...row, idx });
    });

    let no = 1;
    if (shouldMerge()) {
      // Merge order-related columns
      Object.values(groups).forEach(group => {
        const orderTotal = group.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
        const paymentMethod = group[0].paymentMethod || "";

        group.forEach((row, i) => {
          total += Number(row.price) * Number(row.quantity);
          const tr = document.createElement("tr");
          if (i === 0) {
            tr.innerHTML += `<td rowspan="${group.length}">${no++}</td>`;
            tr.innerHTML += `<td rowspan="${group.length}">${row.orderId}</td>`;
            tr.innerHTML += `<td rowspan="${group.length}">${row.orderDate}</td>`;
            tr.innerHTML += `<td rowspan="${group.length}" style="text-align:center;">${paymentMethod}</td>`;
          }
          tr.innerHTML += `
            <td>${row.foodType}</td>
            <td>${row.foodName}</td>
            <td style="text-align:center;">${row.quantity}</td>
            <td>${Number(row.price).toFixed(2)}</td>
            <td>${(Number(row.price) * Number(row.quantity)).toFixed(2)}</td>
          `;
          if (i === 0) {
            tr.innerHTML += `<td rowspan="${group.length}">${orderTotal.toFixed(2)}</td>`;
          }
          tableBody.appendChild(tr);
        });
      });
    } else {
      // Unmerge: show all columns for every row and sort by currentSort
      let flatRows = [];
      Object.values(groups).forEach(group => flatRows.push(...group));
      // Sort flatRows according to currentSort
      flatRows.sort((a, b) => {
        let aVal, bVal;
        if (currentSort.key === "totalPrice") {
          aVal = Number(a.price) * Number(a.quantity);
          bVal = Number(b.price) * Number(b.quantity);
        } else {
          aVal = a[currentSort.key];
          bVal = b[currentSort.key];
        }
        if (aVal < bVal) return currentSort.asc ? -1 : 1;
        if (aVal > bVal) return currentSort.asc ? 1 : -1;
        return 0;
      });
      flatRows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML += `<td style="text-align:center;">${idx + 1}</td>`;
        tr.innerHTML += `<td style="text-align:center;">${row.orderId}</td>`;
        tr.innerHTML += `<td style="text-align:center;">${row.orderDate}</td>`;
        tr.innerHTML += `<td style="text-align:center;">${row.paymentMethod}</td>`;
        tr.innerHTML += `<td>${row.foodType}</td>`;
        tr.innerHTML += `<td>${row.foodName}</td>`;
        tr.innerHTML += `<td style="text-align:center;">${row.quantity}</td>`;
        tr.innerHTML += `<td>${Number(row.price).toFixed(2)}</td>`;
        tr.innerHTML += `<td>${(Number(row.price) * Number(row.quantity)).toFixed(2)}</td>`;
        tr.innerHTML += `<td>${groups[`${row.orderId}_${row.orderDate}`].reduce((sum, r) => sum + Number(r.price) * Number(r.quantity), 0).toFixed(2)}</td>`;
        total += Number(row.price) * Number(row.quantity);
        tableBody.appendChild(tr);
      });
    }

    // Update the footer total cell only
    totalAmountCell.innerHTML = `<strong>RM ${total.toFixed(2)}</strong>`;
  }

  // Filter form
  document.getElementById("filterForm").onsubmit = e => {
    e.preventDefault();
    filterOrders();
  };
  document.getElementById("resetBtn").onclick = () => {
    document.getElementById("filterForm").reset();
    document.getElementById("foodNameRow").style.display = "none";
    
    // Clear any validation errors
    yearError.style.display = "none";
    monthError.style.display = "none";
    yearInput.style.borderColor = "";
    monthInput.style.borderColor = "";
    
    // Reset date pickers
    startDateInput.value = "";
    endDateInput.value = "";
    
    filterOrders(); // This will reapply the default today filter
  };

  // Food type change: show/hide food name and populate options
  foodTypeSelect.onchange = () => {
    if (foodTypeSelect.value) {
      document.getElementById("foodNameRow").style.display = "";
      renderFoodNameOptions(foodTypeSelect.value);
    } else {
      document.getElementById("foodNameRow").style.display = "none";
      foodNameSelect.innerHTML = `<option value="">All</option>`;
    }
  };

  // Export to Excel
  document.getElementById("exportBtn").onclick = async () => {
    // 1. Get stall name
    let stallName = "Stall";
    try {
        const stallDoc = await db.collection("stalls").doc(stallId).get();
        if (stallDoc.exists && stallDoc.data().name) {
            stallName = stallDoc.data().name;
        }
    } catch (e) {}

    // 2. Prepare worksheet data (Payment Method after Order Date)
    const ws_data = [];
    ws_data.push([stallName]);
    ws_data.push([]);
    ws_data.push([
        "No.", "Order ID", "Order Date", "Payment Method", "Food Type", "Food Name", "Quantity", "Price (RM)", "Total Price (RM)", "Total Amount (RM)"
    ]);
    let exportRows = [];
    let no = 1;
    let groups = {};
    lastFilteredRows.forEach(row => { // <--- use filtered data
        const key = `${row.orderId}_${row.orderDate}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    });
    Object.values(groups).forEach((group, groupIdx) => {
        const orderTotal = group.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
        const paymentMethod = group[0].paymentMethod || "";
        group.forEach((row, i) => {
            exportRows.push([
                i === 0 ? no : "",
                i === 0 ? row.orderId : "",
                i === 0 ? row.orderDate : "",
                i === 0 ? paymentMethod : "",
                row.foodType,
                row.foodName,
                row.quantity,
                Number(row.price).toFixed(2),
                (Number(row.price) * Number(row.quantity)).toFixed(2),
                i === 0 ? orderTotal.toFixed(2) : ""
            ]);
        });
        no++;
    });
    exportRows.forEach(row => ws_data.push(row));
    ws_data.push(["", "", "", "", "", "", "", "", "Total", totalAmountCell.textContent.replace("RM ", "")]);

    // 3. Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Summary');

    // 4. Add data to worksheet
    ws_data.forEach(row => sheet.addRow(row));

    // 5. Merge stall name row
    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = stallName;
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A1').font = { bold: true, size: 14 };

    // 6. Header styling (A3:J3)
    const headerRow = sheet.getRow(3);
    headerRow.font = { bold: true };
    for (let j = 1; j <= 10; j++) {
        const cell = headerRow.getCell(j);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thick' }
        };
    }

    // 7. Make every cell middle aligned (vertical and horizontal)
    for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        for (let j = 1; j <= 10; j++) {
            row.getCell(j).alignment = { horizontal: 'center', vertical: 'middle' };
        }
    }

    // 8. Last row: Total and Amount styling
    const totalRow = sheet.rowCount;
    // Apply top border to the whole last row
    for (let j = 1; j <= 10; j++) {
        sheet.getCell(totalRow, j).border = {
            top: { style: 'thin' }
        };
    }
    // "Total" cell (I column): right align, bold, only top border
    sheet.getCell(`I${totalRow}`).font = { bold: true };
    sheet.getCell(`I${totalRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
    // Amount cell (J column): bold, top and double bottom border
    sheet.getCell(`J${totalRow}`).font = { bold: true };
    sheet.getCell(`J${totalRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(`J${totalRow}`).border = {
        top: { style: 'thin' },
        bottom: { style: 'double' }
    };

    // 9. Autofit columns and row heights
    sheet.columns.forEach(column => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellValue = cell.value ? cell.value.toString() : '';
            maxLength = Math.max(maxLength, cellValue.length + 2);
        });
        column.width = maxLength;
    });
    // Autofit row heights (ExcelJS does not support perfect autofit, but you can set a reasonable height)
    for (let i = 1; i <= sheet.rowCount; i++) {
        sheet.getRow(i).height = 20;
    }

    // 10. Save file
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${stallName.replace(/[\\/:*?"<>|]/g, "_")}_order_summary.xlsx`);
};

  // Back button
  document.getElementById("backBtn").onclick = () => {
    window.location.href = `Stall_Screen_Index.html?stallId=${stallId}`;
  };

  // Add sorting event listeners to table headers (except No.)
  document.querySelectorAll("#summaryTable th[data-sort]").forEach(th => {
    th.onclick = () => {
      const key = th.getAttribute("data-sort");
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.key = key;
        currentSort.asc = true;
      }
      filterOrders();
    };
  });

  await fetchOrders();
});