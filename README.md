# DriveMio

[<img src="captures/Screenshot_2026_09_13_17_57_35.png"/>](captures/Screenshot_2026_09_13_17_57_35.png)

DriveMio is a personal Stremio addon for streaming private Google Drive videos on Stremio-compatible clients such as Nuvio TV. A Cloudflare Worker serves the addon catalog and streams video from Drive with signed URLs and byte-range support. Media metadata is generated locally from a Drive folder; your Google credentials and generated catalog stay out of the source repository.

The project is designed for a single owner and does not provide multi-user accounts or video transcoding.

## Documentation

- [English guide](docs/en/README.md)
- [Vietnamese guide](docs/vi/README.md)

Both guides explain the example settings, walk through Google Drive and Cloudflare setup, and list every `make` command.

## Screenshots

[<img src="captures/Screenshot_2026_09_13_16_27_43_35_f1c980342b0e858ddfa283cbd93d4e69.jpg" width="300"/>](image.png)

[<img src="captures/Screenshot_2026_09_13_16_28_01_90_f1c980342b0e858ddfa283cbd93d4e69.jpg"/>](image.png)

[<img src="captures/Screenshot_2026_09_13_16_36_43.png"/>](captures/Screenshot_2026_09_13_16_36_43.png)
