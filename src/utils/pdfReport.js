import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const currency = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
        .format(value)
        .replace(/^/, "INR ")
    : "—";

const duration = (months) => {
  if (!Number.isFinite(months)) return "Does not close";
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return `${months} months (${years} years${remaining ? ` ${remaining} months` : ""})`;
};

const resultValue = (result, render) =>
  result?.paidOff ? render(result) : "Does not close";

export function downloadLoanReport({
  loan,
  profileName,
  username,
  current,
  scenarios,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generatedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const results = [current, ...scenarios];
  const emis = [Number(loan.currentEmi), ...(loan.scenarios || []).map(Number)];
  const scenarioOptions = scenarios
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result?.paidOff);
  const best = scenarioOptions.sort(
    (a, b) => a.result.totalInterest - b.result.totalInterest,
  )[0];
  const savings = scenarioOptions.map(({ result }) =>
    current?.paidOff ? current.totalInterest - result.totalInterest : 0,
  );
  const times = scenarioOptions.map(({ result }) =>
    current?.paidOff ? current.months - result.months : 0,
  );
  const maximumInterestSaved = Math.max(0, ...savings);
  const maximumTimeSaved = Math.max(0, ...times);
  const headers = [
    "Repayment metric",
    "Current EMI",
    "Scenario 1",
    "Scenario 2",
    "Scenario 3",
  ];

  doc.setFillColor(20, 40, 72);
  doc.rect(0, 0, 210, 47, "F");
  doc.setFillColor(40, 100, 232);
  doc.rect(0, 45, 210, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("EMI REPAY SIMULATOR", 15, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(202, 217, 240);
  doc.text("LOAN REPAYMENT REPORT", 15, 29);
  doc.text(`Generated ${generatedAt}`, 15, 37);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(24, 34, 48);
  doc.text(doc.splitTextToSize(profileName, 125), 15, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 116, 138);
  doc.text(`Account: ${username}`, 15, 66);

  autoTable(doc, {
    startY: 71,
    head: [["Loan detail", "Value", "Loan detail", "Value"]],
    body: [
      [
        "Outstanding principal",
        currency(Number(loan.principal)),
        "Current EMI",
        currency(Number(loan.currentEmi)),
      ],
      [
        "Annual interest rate",
        `${Number(loan.annualRate)}% p.a.`,
        "Remaining tenure (statement)",
        `${Number(loan.balanceTenure)} months`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [40, 100, 232], fontSize: 8, cellPadding: 3 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [48, 61, 80],
      lineColor: [224, 231, 241],
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 49 },
      1: { cellWidth: 42 },
      2: { fontStyle: "bold", cellWidth: 49 },
      3: { cellWidth: 42 },
    },
  });

  const rows = [
    ["Monthly EMI", ...emis.map(currency)],
    [
      "Additional EMI",
      ...emis.map((emi, index) =>
        index ? currency(emi - emis[0]) : "Baseline",
      ),
    ],
    [
      "First-month interest",
      ...results.map((result) => currency(result?.firstMonthInterest)),
    ],
    [
      "First-month principal",
      ...results.map((result) => currency(result?.firstMonthPrincipal)),
    ],
    [
      "Loan closure period",
      ...results.map((result) =>
        resultValue(result, (value) => duration(value.months)),
      ),
    ],
    [
      "Principal repaid",
      ...results.map((result) =>
        resultValue(result, (value) =>
          currency(value.principalRepaid ?? loan.principal),
        ),
      ),
    ],
    [
      "Total interest payable",
      ...results.map((result) =>
        resultValue(result, (value) => currency(value.totalInterest)),
      ),
    ],
    [
      "Total repayment amount",
      ...results.map((result) =>
        resultValue(result, (value) => currency(value.totalPaid)),
      ),
    ],
    [
      "Interest saved",
      ...results.map((result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? currency(current.totalInterest - result.totalInterest)
            : "—",
      ),
    ],
    [
      "Time saved",
      ...results.map((result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? current.months >= result.months
              ? `${current.months - result.months} months sooner`
              : `${result.months - current.months} months longer`
            : "—",
      ),
    ],
    [
      "Post-payoff EMI cash flow freed",
      ...results.map((result, index) => {
        if (index === 0) return "Baseline";
        if (!current?.paidOff || !result?.paidOff) return "—";
        const monthsSaved = current.months - result.months;
        return monthsSaved > 0 ? currency(monthsSaved * emis[index]) : "—";
      }),
    ],
    [
      "Value of saved months",
      ...results.map((result, index) => {
        if (index === 0) return "Baseline";
        if (!current?.paidOff || !result?.paidOff) return "—";
        const monthsSaved = current.months - result.months;
        return monthsSaved > 0
          ? `${monthsSaved} x ${currency(emis[index])} = ${currency(monthsSaved * emis[index])}`
          : monthsSaved < 0
            ? `${Math.abs(monthsSaved)} months longer`
            : "No months saved";
      }),
    ],
    [
      "Net repayment saved vs current EMI",
      ...results.map((result, index) =>
        index === 0
          ? "Baseline"
          : current?.paidOff && result?.paidOff
            ? currency(current.totalPaid - result.totalPaid)
            : "—",
      ),
    ],
    [
      "Interest-to-principal ratio",
      ...results.map((result) =>
        result?.paidOff
          ? `${(result.interestToPrincipalRatio * 100).toFixed(2)}%`
          : "—",
      ),
    ],
    [
      "Bank-stated balance tenure",
      ...results.map(() => `${Number(loan.balanceTenure)} months`),
    ],
    [
      "Final instalment",
      ...results.map((result) =>
        resultValue(result, (value) => currency(value.finalPayment)),
      ),
    ],
  ];
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [26, 43, 72],
      fontSize: 7.5,
      cellPadding: 3,
      textColor: [255, 255, 255],
    },
    styles: {
      fontSize: 7.1,
      cellPadding: 2.4,
      textColor: [48, 61, 80],
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.12,
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 34.5 },
      2: { cellWidth: 34.5 },
      3: { cellWidth: 34.5 },
      4: { cellWidth: 34.5 },
    },
    didParseCell(data) {
      if (
        data.section === "body" &&
        data.column.index > 0 &&
        /saved|freed|value of/i.test(String(data.row.raw?.[0]))
      ) {
        data.cell.styles.textColor =
          String(data.cell.raw).includes("INR -") ||
          String(data.cell.raw).includes("months longer")
            ? [185, 107, 57]
            : [15, 139, 103];
      }
    },
  });

  let summaryY = doc.lastAutoTable.finalY + 10;
  if (summaryY > 245) {
    doc.addPage();
    summaryY = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 34, 48);
  doc.text("Summary", 15, summaryY);
  const summaryCards = [
    {
      label: "BEST SCENARIO",
      value: best
        ? `Scenario ${best.index + 1} · ${currency(loan.scenarios[best.index])}`
        : "No closing scenario",
    },
    { label: "MAX INTEREST SAVED", value: currency(maximumInterestSaved) },
    { label: "MAX TIME SAVED", value: `${maximumTimeSaved} months` },
  ];
  summaryCards.forEach((card, index) => {
    const x = 15 + index * 61;
    doc.setFillColor(246, 249, 253);
    doc.setDrawColor(224, 231, 241);
    doc.roundedRect(x, summaryY + 5, 57, 25, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(111, 126, 147);
    doc.text(card.label, x + 3, summaryY + 12);
    doc.setFontSize(8);
    doc.setTextColor(30, 62, 103);
    doc.text(doc.splitTextToSize(card.value, 51), x + 3, summaryY + 21);
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(76, 91, 112);
  const summary = [
    "The post-payoff cash-flow estimate equals months saved multiplied by that scenario's EMI. It is not additional net savings; net repayment saved is shown separately in the comparison.",
    "Assumptions: monthly reducing-balance interest at annual rate / 1200; payments made monthly; final instalment adjusted to the exact balance due.",
    "Estimates only. Floating-rate changes, lender fees, insurance, daily-interest conventions, and lender-specific rounding are not modelled.",
  ];
  let y = summaryY + 38;
  for (const line of summary) {
    const wrapped = doc.splitTextToSize(line, 178);
    if (y + wrapped.length * 4 > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(wrapped, 16, y);
    y += wrapped.length * 4 + 2;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(132, 144, 160);
    doc.text(`EMI Repay Simulator · ${page} / ${pages}`, 195, 287, {
      align: "right",
    });
  }

  const safeName =
    profileName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "loan";
  doc.save(`emi-studio-${safeName}-report.pdf`);
}
