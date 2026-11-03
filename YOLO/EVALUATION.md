# YOLO occupancy evaluation

Evaluation mode is disabled by default, so normal operation does not retain
camera images or write evaluation records. When enabled, each Python process
creates a new timestamped session under `YOLO\evaluation\`. A session contains
`evaluation.csv`, the original unannotated frames in `original\`, and the
person-only annotated frames in `annotated\`.

The CSV starts with the predicted count and inference time. The
`ground_truth_count`, `absolute_error`, and `exact_match` columns are blank for
manual completion; predictions are never used as ground truth. Image paths in
the CSV are relative to the session directory.

## Run a new evaluation session (PowerShell)

From the repository root:

```powershell
Set-Location .\YOLO
$env:EVALUATION_MODE = "true"
python .\main.py
```

The existing backend configuration and camera connection setup are still
required. The pipeline continues to process the real RTSP stream and submit
occupancy counts to the backend.

By default, the session saves at most 100 successful observations, sampled at
the existing 10-second interval. Set `$env:MAX_EVALUATION_SAMPLES` before
launching to use another positive limit. Once the limit is reached, evidence
collection stops automatically but camera processing and backend occupancy
reporting continue. Stop the pipeline with `Ctrl+C` when finished.

Every new process launch creates a separate session directory. To disable
evaluation, stop the process and start it without `EVALUATION_MODE`, or set
`$env:EVALUATION_MODE = "false"`. `EVALUATION_OUTPUT_DIR` can optionally be set
to change the output root; its default is `evaluation` relative to the YOLO
working directory.
