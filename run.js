const visorPdf = PdfViewer.create("pdf-place-holder/Placeholder-PDF.pdf");

window.onload = () => {

    const pdfContainer = document.querySelector("div.pdf-container")
    visorPdf.mount(pdfContainer);

    /*     setTimeout(() => {
    
            visorPdf.setFile("pdf-place-holder/Placeholder-PDF.pdf")
        }, 10000) */


}
