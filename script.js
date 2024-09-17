// Import pdf.js from the local file
import * as pdfjsLib from './libs/pdf.min.mjs';

// Set the worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdf.worker.min.mjs';

// Select HTML elements for interactivity
const pdfUpload = document.getElementById('pdf-upload');
const uploadSection = document.getElementById('upload-section');
const pageList = document.getElementById('page-list');
const mergeBtn = document.getElementById('merge-btn');
const downloadLink = document.getElementById('download-link');

const modal = document.getElementById('modal');
const modalCanvas = document.getElementById('modal-canvas');
const closeBtn = document.querySelector('.close-btn');

let pagesArray = []; // Array to store PDF pages
const pdfFiles = new Map(); // Map to store loaded PDFs
let pageIdCounter = 0; // Counter for unique page IDs
let fileIdCounter = 1; // Counter for unique file IDs

// Initialize sortable functionality using Sortable.js
const sortable = new Sortable(pageList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    scroll: true,
    scrollSensitivity: 100,
    scrollSpeed: 10,
    bubbleScroll: true,
    onEnd: function (evt) {
        // Update the order of pages in the array when the user drops an item
        const newOrder = Array.from(pageList.children).map(child => parseInt(child.getAttribute('data-id')));
        const newPagesArray = newOrder.map(id => pagesArray.find(page => page.id === id)).filter(page => page !== undefined);
        pagesArray = newPagesArray;
    }
});

// Function to update the list of page thumbnails
function updatePageList() {
    pageList.innerHTML = ''; // Clear the list before updating
    pagesArray.forEach((page) => {
        const div = document.createElement('div');
        div.classList.add('page-item');
        div.setAttribute('data-id', page.id);
        div.setAttribute('draggable', 'false'); // Prevents the thumbnail from being individually dragged
        div.innerHTML = `
            <img src="${page.thumbnail}" alt="Page ${page.pageNumber}" draggable="false">
            <div class="page-info">${page.fileDisplayName} - Page ${page.pageNumber}</div>
            <button class="remove-btn" onclick="removePage(${page.id})">&times;</button>
        `;
        pageList.appendChild(div); // Add the thumbnail to the list

        // Add double-click event to open the modal
        div.addEventListener('dblclick', () => {
            openModal(page);
        });
    });

    // Show or hide the list depending on whether there are pages in the array
    if (pagesArray.length > 0) {
        pageList.style.display = 'grid';
    } else {
        pageList.style.display = 'none';
    }
}

// Function to open the modal and render the selected page
async function openModal(page) {
    modal.classList.add('open');

    const context = modalCanvas.getContext('2d');

    // Clear the canvas
    context.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    try {
        let fileData = pdfFiles.get(page.fileId);

        // Load the pdf.js document if not already loaded
        if (!fileData.pdfjsDoc) {
            fileData.pdfjsDoc = await pdfjsLib.getDocument({ data: fileData.pdfBuffer.slice(0) }).promise;
        }

        const pdfPage = await fileData.pdfjsDoc.getPage(page.pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1 });

        // Calculate scale to fit the page in the modal
        const scale = Math.min(
            (modalCanvas.parentElement.clientWidth - 40) / viewport.width,
            (modalCanvas.parentElement.clientHeight - 40) / viewport.height
        );

        const scaledViewport = pdfPage.getViewport({ scale: scale });
        modalCanvas.width = scaledViewport.width;
        modalCanvas.height = scaledViewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };

        await pdfPage.render(renderContext).promise;
    } catch (error) {
        console.error('Error rendering page in modal:', error);
        alert(`Error rendering the page. See console for details.`);
    }
}

// Event to close the modal when clicking the close button
closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
});

// Close the modal when clicking outside the content
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('open');
    }
});

// Function to remove a page from the array
function removePage(id) {
    pagesArray = pagesArray.filter(page => page.id !== id); // Remove the page with the corresponding ID
    updatePageList(); // Update the list after removal
}

// Make the removePage function globally accessible
window.removePage = removePage;

// Event to handle file uploads via file input
pdfUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files); // Convert uploaded files to an array
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file); // Process the PDF file
        }
    });
    pdfUpload.value = ''; // Clear the input after upload
});

// Event to handle dragging files over the upload area
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault(); // Prevent default browser behavior
    uploadSection.classList.add('dragover'); // Add styling class when dragging
});

// Event to remove dragover style when the mouse leaves the upload area
uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover'); // Remove styling class
});

// Event to handle dropping files in the upload area
uploadSection.addEventListener('drop', (e) => {
    e.preventDefault(); // Prevent default browser behavior
    uploadSection.classList.remove('dragover'); // Remove dragover style
    const files = Array.from(e.dataTransfer.files); // Get the dropped files
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file); // Process the PDF file
        }
    });
});

// Function to process and display the pages of the PDF
async function processPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const bufferForPDFJS = arrayBuffer.slice(0);
        const bufferForPDFLib = arrayBuffer.slice(0);

        // Store the buffer in the pdfFiles map
        const fileId = pageIdCounter++;
        const fileDisplayName = `File ${fileIdCounter++}`; // Assign a short name to the file
        pdfFiles.set(fileId, {
            fileName: file.name,
            fileDisplayName: fileDisplayName, // Store the short name
            pdfBuffer: bufferForPDFLib,
            numPages: 0,
            pdfDoc: null, // For PDFLib document
            pdfjsDoc: null // For pdf.js document
        });

        const loadingTask = pdfjsLib.getDocument({ data: bufferForPDFJS });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        // Update the number of pages
        pdfFiles.get(fileId).numPages = numPages;

        // Iterate over each page of the PDF
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                const scale = 0.2; // Set thumbnail scale
                const scaledViewport = page.getViewport({ scale: scale });
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: scaledViewport
                };

                await page.render(renderContext).promise;

                const thumbnail = canvas.toDataURL();

                // Add the processed page to the pages array
                pagesArray.push({
                    id: pageIdCounter++,
                    fileId: fileId,
                    fileName: file.name,
                    fileDisplayName: fileDisplayName, // Use the short name
                    pageNumber: pageNum,
                    pageIndex: pageNum - 1,
                    thumbnail: thumbnail
                });

                updatePageList(); // Update the thumbnails list
            } catch (error) {
                console.error(`Error processing page ${pageNum} of file ${file.name}:`, error);
                alert(`Error processing page ${pageNum} of file ${file.name}. See console for details.`);
            }
        }
    } catch (error) {
        console.error(`Error loading file ${file.name}:`, error);
        alert(`Error loading file ${file.name}. See console for details.`);
    }
}

// Event when clicking the merge PDFs button
mergeBtn.addEventListener('click', async () => {
    if (pagesArray.length < 2) {
        alert('Please add at least two pages to merge.'); // Check if there are enough pages
        return;
    }

    mergeBtn.disabled = true; // Disable the button during merging
    mergeBtn.textContent = 'Merging...'; // Change button text to indicate the process
    downloadLink.style.display = 'none'; // Hide the download link

    try {
        const mergedPdf = await PDFLib.PDFDocument.create(); // Create a new empty PDF document

        // Copy and add each page to the merged PDF
        for (const page of pagesArray) {
            let fileData = pdfFiles.get(page.fileId);

            // Load the PDFLib document if not already loaded
            if (!fileData.pdfDoc) {
                fileData.pdfDoc = await PDFLib.PDFDocument.load(fileData.pdfBuffer.slice(0));
            }

            const [copiedPage] = await mergedPdf.copyPages(fileData.pdfDoc, [page.pageIndex]); // Copy the page from the PDF
            mergedPdf.addPage(copiedPage); // Add the page to the new PDF
        }

        const mergedPdfFile = await mergedPdf.save(); // Save the merged PDF as a byte array
        const blob = new Blob([mergedPdfFile], { type: 'application/pdf' }); // Create a blob from the PDF
        const url = URL.createObjectURL(blob); // Generate a URL for download

        downloadLink.href = url; // Set the URL in the download link
        downloadLink.style.display = 'block'; // Show the download link
    } catch (error) {
        console.error('An error occurred while merging PDFs:', error);
        alert(`An error occurred while merging PDFs: ${error.message}`);
    } finally {
        mergeBtn.disabled = false; // Re-enable the button after the process
        mergeBtn.textContent = 'Merge PDFs'; // Restore the original button text
    }
});
