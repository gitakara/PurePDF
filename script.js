let files = [];
let processedPdfBytes = null;

const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const progress = document.getElementById('progress');
const previewFrame = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');

// --- Event Listeners ---

dropzone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'application/pdf';
  input.onchange = e => handleFiles(e.target.files);
  input.click();
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--accent)';
});

dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = 'var(--border)';
});

dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--border)';
  handleFiles(e.dataTransfer.files);
});

document.getElementById('mergeBtn').onclick = mergePDFs;
document.getElementById('splitBtn').onclick = splitPDF;
document.getElementById('downloadBtn').onclick = downloadPDF;
document.getElementById('themeToggle').onclick = toggleDarkMode;

// --- Core Functions ---

function handleFiles(selectedFiles) {
  for (let file of selectedFiles) {
    if (file.type === 'application/pdf') files.push(file);
  }
  renderList();
}

function renderList() {
  fileList.innerHTML = '';
  files.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.draggable = true;
    li.innerHTML = `
      <span>📄 ${file.name}</span>
      <button onclick="removeFile(${index})" style="background:none; border:none; cursor:pointer;">❌</button>
    `;

    li.ondragstart = e => e.dataTransfer.setData('index', index);
    li.ondragover = e => e.preventDefault();
    li.ondrop = e => {
      const from = e.dataTransfer.getData('index');
      const temp = files[from];
      files[from] = files[index];
      files[index] = temp;
      renderList();
    };
    fileList.appendChild(li);
  });
}

function removeFile(idx) {
  files.splice(idx, 1);
  renderList();
}

async function mergePDFs() {
  if (files.length < 2) return alert('Pilih minimal 2 file untuk digabung.');
  updateStatus('Sedang menggabungkan...');
  
  const { PDFDocument } = PDFLib;
  const mergedPdf = await PDFDocument.create();

  for (let file of files) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(p => mergedPdf.addPage(p));
  }

  processedPdfBytes = await mergedPdf.save();
  updatePreview();
  updateStatus('Berhasil digabung!');
}

async function splitPDF() {
  if (files.length === 0) return;
  const rangeStr = document.getElementById('pageRange').value;
  if (!rangeStr) return alert('Masukkan range halaman (contoh: 1-2).');

  updateStatus('Sedang memisahkan...');
  const { PDFDocument } = PDFLib;
  const bytes = await files[0].arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();

  const pages = parseRange(rangeStr, pdf.getPageCount());
  const copiedPages = await newPdf.copyPages(pdf, pages);
  copiedPages.forEach(p => newPdf.addPage(p));

  processedPdfBytes = await newPdf.save();
  updatePreview();
  updateStatus('Berhasil dipisah!');
}

// --- Helpers ---

function parseRange(range, max) {
  let pages = [];
  range.split(',').forEach(part => {
    if (part.includes('-')) {
      let [start, end] = part.split('-').map(x => parseInt(x.trim()) - 1);
      for (let i = start; i <= end; i++) pages.push(i);
    } else {
      pages.push(parseInt(part.trim()) - 1);
    }
  });
  return pages.filter(p => p >= 0 && p < max);
}

function updatePreview() {
  const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
  previewFrame.src = URL.createObjectURL(blob);
  downloadBtn.disabled = false;
}

function downloadPDF() {
  const name = document.getElementById('fileName').value || 'PDFKilat_Hasil';
  const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '.pdf';
  a.click();
}

function updateStatus(txt) { progress.textContent = txt; }

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const icon = document.getElementById('themeIcon');
  
  if (document.body.classList.contains('dark')) {
    icon.textContent = 'light_mode'; // Jika gelap, tampilkan ikon matahari untuk kembali ke terang
  } else {
    icon.textContent = 'dark_mode'; // Jika terang, tampilkan ikon bulan untuk kembali ke gelap
  }
}
