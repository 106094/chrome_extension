#!/bin/bash

# Generate timestamped log file
timestamp=$(date +"%Y%m%d_%H%M%S")
logdir="/home/chronos/user/MyFiles/log_$timestamp"
endline="======END====="
mkdir -p "$logdir"
chmod -R a+rwX "$logdir"
default_logfile="$logdir/runtest_all.log"
export PAUSE_LINES=35

# assume you already have: timestamp, logdir, default_logfile set
soft_pause() {
  local secs=${1:-2}
  local rows=${PAUSE_LINES:-$( (tput lines 2>/dev/null || echo 24) )}
  local per=$(( rows > 2 ? rows - 2 : rows ))

  local count=0
  while IFS= read -r line; do
    echo "$line"
    (( ++count % per == 0 )) && sleep "$secs"
  done
}
logrun() {
  local logname="" use_shell=0 cmdstr=""
  # parse options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -l|--log) logname="$2"; shift 2 ;;
      -c|--command) use_shell=1; shift; cmdstr="$*"; break ;;  # take the rest as a shell command
      --) shift; break ;;
      *) break ;;
    esac
  done
  local addlog=""
  [[ -n "$logname" ]] && addlog="$logdir/runtest_${logname}.log"
  clear
  if (( use_shell )); then
    # log the command line
   if [[ -n "$addlog" ]]; then
  echo "$(pwd) \$ $cmdstr" | tee -a "$default_logfile" | tee -a "$addlog"

  # Run the command, pipe output to both logs
  bash -lc "$cmdstr" 2>&1 \
    | sed -r 's/\x1B\[[0-9;?]*[ -/]*[@-~]//g' \
    | tee -a "$default_logfile" \
    | tee -a "$addlog" \
    | soft_pause "${PAUSE_SECS:-2}"

  # Append END marker only to default log
  echo "======END=====" >> "$default_logfile"
else
  echo "$(pwd) \$ $cmdstr" | tee -a "$default_logfile"

  bash -lc "$cmdstr" 2>&1 \
    | sed -r 's/\x1B\[[0-9;?]*[ -/]*[@-~]//g' \
    | tee -a "$default_logfile" \
    | soft_pause "${PAUSE_SECS:-2}"

  echo "======END=====" >> "$default_logfile"
fi
  else
    # argv mode (no shell operators)
    if [[ $# -eq 0 ]]; then
      echo "Usage: logrun [-l LOGNAME] [-c 'cmd...'] command [args...]"; return 2
    fi
    if [[ -n "$addlog" ]]; then
      # Log command line to both logs
      echo "$(pwd) \$ $*" | tee -a "$default_logfile" | tee -a "$addlog"

      # Run command, log output to both
      { "$@"; } 2>&1 \
        | sed -r 's/\x1B\[[0-9;?]*[ -/]*[@-~]//g' \
        | tee -a "$default_logfile" \
        | tee -a "$addlog" \
        | soft_pause "${PAUSE_SECS:-2}"

      # End marker → only default log
      echo "======END=====" >> "$default_logfile"

    else
      # Log command line only to default
      echo "$(pwd) \$ $*"
      echo "$(pwd) \$ $*" >> "$default_logfile"

      # Run command, log output
      { "$@"; } 2>&1 \
        | sed -r 's/\x1B\[[0-9;?]*[ -/]*[@-~]//g' \
        | tee -a "$default_logfile" \
        | soft_pause "${PAUSE_SECS:-2}"

      # End marker → only default log
      echo "======END=====" >> "$default_logfile"
    fi
  fi
 #sleep 2
}


# Examples
# logrun -l net ls -l /etc
# logrun -l sys uname -a
# logrun df -h
# echo "Logs at: $default_logfile (and per-logname files if used)"

logrun -l battery -c 'ectool battery'
logrun -l chipinfo -c 'ectool chipinfo'
logrun -l version -c 'ectool version'
logrun -l lsb_release -c 'cat /etc/lsb-release'
logrun -l lsb_desc -c 'cat /etc/lsb-release | grep RELEASE_DESC'
logrun -l lsautotest -c 'ls -dl /usr/local/autotest'
logrun -l system -c 'lshw -C system'
logrun -l cpu -c 'lshw -C cpu'
logrun -l memory -c 'lshw -C memory'
logrun -l lspci -c 'lspci -n'
logrun -l lsusb -c 'lsusb'
logrun -l panel -c 'cat /sys/class/drm/card0-eDP-1/edid | edid-decode '
logrun -l backlight -c 'backlight_tool --get_initial_brightness --lux=150'
logrun -l backlightMax -c 'backlight_tool --get_max_brightness'


echo "All Logs at: $default_logfile (and per-logname files if used) - $(date '+%Y-%m-%d %H:%M:%S') "

