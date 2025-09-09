// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements from uploader.html
    const uploadButton = document.getElementById('uploadButton');
    const folderInput = document.getElementById('folderInput');
    const statusDiv = document.getElementById('status');

    // --- Event Listener for the button click ---
    uploadButton.addEventListener('click', () => {
        // Trigger the hidden file selection dialog
        folderInput.click();
    });

    // --- Event Listener for when a folder is selected ---
    folderInput.addEventListener('change', async (event) => {
        const files = event.target.files;

        if (files.length === 0) {
            updateStatus('Upload cancelled. No folder selected.', 'text-yellow-600');
            return;
        }

        // The user has selected a folder. Proceed with the upload process.
        updateStatus(`Found ${files.length} files in the selected folder.`, 'text-blue-600');
        uploadButton.disabled = true; // Disable the button during upload

        // --- Google Drive API Integration ---
        // IMPORTANT: Replace this placeholder with your actual Google Drive folder ID.
        // The ID is found in the URL of the folder in your browser.
        const googleDriveFolderId = "1CIprYUtSpEu1UjkTZYeZIkxdY6I0JHGw";

        try {
            await uploadFilesToDrive(files, googleDriveFolderId);

            // If the upload is successful
            updateStatus('Upload completed successfully!', 'text-green-600 font-semibold');
            
            // Close the window after a short delay
            setTimeout(() => {
                window.close();
            }, 2000);
            
        } catch (error) {
            // Handle any errors that occur during the upload process
            updateStatus(`Upload failed: ${error.message}`, 'text-red-600 font-semibold');
            console.error('Upload Error:', error);
            uploadButton.disabled = false; // Re-enable button on failure
        }
    });

    /**
     * Uploads a list of files to a specific Google Drive folder.
     * This function first creates a new folder on Google Drive and then uploads the files into it.
     * @param {FileList} files The list of files to upload.
     * @param {string} parentFolderId The ID of the target Google Drive parent folder.
     */
    async function uploadFilesToDrive(files, parentFolderId) {
        try {
            const accessToken = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ 'interactive': true }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                    resolve(token);
                });
            });

            if (!accessToken) {
                throw new Error('Failed to get an access token for Google Drive.');
            }

            // Get the name of the top-level folder from the first file's webkitRelativePath
            const topLevelFolderName = files[0].webkitRelativePath.split('/')[0];
            updateStatus(`Creating folder '${topLevelFolderName}' in Google Drive...`, 'text-gray-600');

            const newFolderId = await createFolder(topLevelFolderName, parentFolderId, accessToken);
            updateStatus(`Folder created with ID: ${newFolderId}`, 'text-blue-600');

            let fileCount = 0;
            for (const file of files) {
                updateStatus(`Uploading file ${++fileCount} of ${files.length}: ${file.name}...`);

                const metadata = {
                    name: file.name,
                    parents: [newFolderId] // Now using the new folder's ID as the parent
                };

                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                formData.append('file', file);

                const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API upload failed with status ${response.status}: ${errorText}`);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Creates a new folder on Google Drive.
     * @param {string} folderName The name of the new folder.
     * @param {string} parentId The ID of the parent folder where the new folder will be created.
     * @param {string} accessToken The OAuth access token.
     * @returns {Promise<string>} A promise that resolves with the ID of the newly created folder.
     */
    async function createFolder(folderName, parentId, accessToken) {
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };

        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create folder: ${errorText}`);
        }

        const folder = await response.json();
        return folder.id;
    }

    /**
     * Updates the status message in the UI.
     * @param {string} message The message to display.
     * @param {string} colorClass The Tailwind CSS class for the text color.
     */
    function updateStatus(message, colorClass = 'text-gray-700 dark:text-gray-300') {
        statusDiv.innerHTML = `<p class="${colorClass}">${message}</p>`;
    }
});
