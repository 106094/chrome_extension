document.addEventListener('DOMContentLoaded', () => {
    const openUploaderButton = document.getElementById('openUploaderButton');
    if (openUploaderButton) {
        openUploaderButton.addEventListener('click', () => {
            chrome.windows.create({
                url: chrome.runtime.getURL("uploader.html"),
                type: "popup",
                width: 450,
                height: 300
            });
            window.close(); // Close the popup immediately
        });
    }
});
