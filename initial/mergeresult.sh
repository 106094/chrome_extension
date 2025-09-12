#!/bin/bash
macfolder=$(ifconfig wlan0 | grep 'ether' | awk '{print $2}'|tr -d ":")
timestamp=$(date +"%Y%m%d_%H%M")
top_folder="/home/chronos/user/MyFiles/results"
base_dir_name="Mac_${macfolder}_${timestamp}-upload"
main_folder="${top_folder}/${base_dir_name}"
screenshots_folder="${main_folder}/screenshots"
logs_folder="${main_folder}/logs"
mkdir -p "$screenshots_folder" "$logs_folder"
chmod -R a+rwX "$top_folder"
: <<'END_COMMENT'
#copy image files
latest_log=$(ls -t "/home/chronos/user/Downloads/DesktopScreenshots/"*desktop.txt 2>/dev/null | head -n 1)
# Check if a log file was found.
if [[ -f "$latest_log" ]]; then
    echo "Found latest log file: $latest_log"

    # 2. Get the content of the log and find all PNG file names.
    # We use sed to extract the filename from the log line.
    png_files=$(grep 'SAVED ->' "$latest_log" | sed -E 's/.*DesktopScreenshots\/(.*) \(id.*/\1/')

    # 3. Iterate through the list of found filenames and copy them.
    for filename in $png_files; do
        source_file="/home/chronos/user/Downloads/DesktopScreenshots/${filename}"
        
        # 4. Copy the file to the newly created screenshots folder.
        # The -v flag provides verbose output, showing which files are copied.
        cp -v "$source_file" "$screenshots_folder"
    done
    
    echo "Copying of screenshots completed."
else
    echo "No desktop log files found in Downloads/DesktopScreenshots/."
fi
END_COMMENT
#copy log files
latest_log_dir=$(ls -td "/home/chronos/user/MyFiles/log"* 2>/dev/null | head -n 1)

# Check if a log directory was found.
if [[ -d "$latest_log_dir" ]]; then
    echo "Found latest log directory: $latest_log_dir"

    # 2. Copy all files from the latest log directory to the new logs folder.
    # We use the asterisk '*' to copy all files inside the source directory.
    cp -v "$latest_log_dir"/* "$logs_folder"
    
    echo "Copying of log files completed."
else
    echo "No log folders found in /home/chronos/user/MyFiles/."
fi

# Find and copy the latest About Version.txt file
latest_version_txt=$(ls -t "/home/chronos/user/Downloads/About Version"*.txt 2>/dev/null | head -n 1)
if [[ -f "$latest_version_txt" ]]; then
    cp -v "$latest_version_txt" "$main_folder"
   echo "Copying version files completed."
else
    echo "No About Version .txt file found."
fi

# Find and copy the latest About Version.png file
latest_version_png=$(ls -t "/home/chronos/user/Downloads/About Version"*.png 2>/dev/null | head -n 1)
if [[ -f "$latest_version_png" ]]; then
    cp -v "$latest_version_png" "$main_folder"
    echo "Copying version image completed."
else
    echo "No About Version .png file found."
fi


