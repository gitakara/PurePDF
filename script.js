let files = [];
let processedPdfBytes = null;

// Element Selectors
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const previewArea = document.getElementById('previewArea');
const themeIcon = document.getElementById('themeIcon');

// Load dark mode preference[cite: 2]
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  themeIcon.textContent = 'light_mode';
}

// --- Event Listeners ---
document.getElementById('themeToggle').onclick = toggleDarkMode;
document.getElementById('helpBtn').onclick = () => {
  alert("Cara Menggunakan:\n1. Upload satu atau lebih file PDF\n2. Geser naik/turun pada file untuk mengatur urutan halaman\n3. Masukkan halaman spesifik yang ingin diedit di kolom halaman\n4. Klik tombol yang ingin digunakan\n5. Tunggu preview muncul, lalu download file hasilnya.");
};

dropzone.onclick = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = 'application/pdf';
  input.onchange = e => handleFiles(e.target.files);
  input.click();
};

document.getElementById('mergeBtn').onclick = mergePDFs;
document.getElementById('splitBtn').onclick = splitPDF;
document.getElementById('downloadBtn').onclick = downloadPDF;
document.getElementById('compressBtn').onclick = compressPDF;

// --- Functions ---

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
    li.draggable = true; // Tetap bisa di-drag untuk mengatur urutan file[cite: 2]
    li.innerHTML = `
      <div class="file-info">
        <span class="material-icons">drag_indicator</span>
        <span class="file-name">📄 ${file.name}</span>
      </div>
      <div class="file-settings">
        <input type="text" 
               class="page-input" 
               placeholder="Halaman (misal: 1,3-5)" 
               id="pages-${index}" 
               title="Kosongkan untuk mengambil semua halaman">
        <button onclick="removeFile(${index})" class="btn-remove">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `;

    // Logika Drag and Drop untuk urutan file[cite: 2]
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
if (files.length < 1) return alert('Pilih minimal 1 file.');
  
  const { PDFDocument } = PDFLib;
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const bytes = await files[i].arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    
    // Ambil input halaman untuk file ini[cite: 2]
    const rangeStr = document.getElementById(`pages-${i}`).value;
    let pagesToCopy;

    if (rangeStr.trim() !== "") {
      // Jika user mengisi range, gunakan parseRange
      pagesToCopy = parseRange(rangeStr, pdf.getPageCount());
    } else {
      // Jika kosong, ambil semua halaman[cite: 2]
      pagesToCopy = pdf.getPageIndices();
    }

    const copiedPages = await mergedPdf.copyPages(pdf, pagesToCopy);
    copiedPages.forEach(p => mergedPdf.addPage(p));
  }

  processedPdfBytes = await mergedPdf.save();
  showResults();
}

async function splitPDF() {
 if (files.length === 0) return alert('Upload file terlebih dahulu.');
  const rangeStr = document.getElementById('pages-0').value;
 
  if (!rangeStr) return alert('Masukkan range halaman pada kotak teks di samping nama file pertama.');

  const { PDFDocument } = PDFLib;
  const bytes = await files[0].arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();

  const pages = parseRange(rangeStr, pdf.getPageCount());
  const copiedPages = await newPdf.copyPages(pdf, pages);
  copiedPages.forEach(p => newPdf.addPage(p));

  processedPdfBytes = await newPdf.save();
  showResults();
}

function showResults() {
  const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
  document.getElementById('preview').src = URL.createObjectURL(blob);
  previewArea.classList.remove('hidden'); // Memunculkan preview[cite: 2]
  document.getElementById('progress').textContent = "Proses Berhasil!";
}

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

function downloadPDF() {
  const name = document.getElementById('fileName').value || 'Pure_Output';
  const blob = new Blob([processedPdfBytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '.pdf';
  a.click();
}

async function compressPDF() {
  if (files.length === 0) return alert('Silakan upload file PDF terlebih dahulu.');
  
  const statusMsg = document.getElementById('progress');
  statusMsg.textContent = "Sedang mengompres...";
  
  try {
    const { PDFDocument } = PDFLib;
    
    // Mengambil file pertama dari antrean
    const bytes = await files[0].arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    
    // Membuat dokumen baru (untuk membuang data yang tidak perlu)
    const compressedPdf = await PDFDocument.create();
    
    // Salin halaman untuk optimasi internal struktur PDF[cite: 2]
    const pages = await compressedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    pages.forEach(page => compressedPdf.addPage(page));

    // Simpan dengan fitur Object Streams untuk memperkecil ukuran file[cite: 2]
    processedPdfBytes = await compressedPdf.save({
      useObjectStreams: true, 
      addDefaultPage: false
    });

    const originalSize = (bytes.byteLength / 1024).toFixed(2);
    const newSize = (processedPdfBytes.length / 1024).toFixed(2);
    
    showResults();
    statusMsg.textContent = `Selesai! Ukuran PDF sudah berkurang, dari ${originalSize}KB menjadi ${newSize}KB.`;
    
  } catch (err) {
    console.error(err);
    alert("Gagal mengompres PDF.");
    statusMsg.textContent = "";
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
  localStorage.setItem('theme', isDark ? 'dark' : 'light'); // Stabilitas dark mode[cite: 2]
}