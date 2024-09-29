.PHONY: default macos

lint:
	cd src-tauri
	cargo clippy
fmt:
	cd src-tauri
	cargo fmt --all --
dev:
	yarn tauri dev
release:
	cargo build --release
macos:
	mv ./target/release/springbok ./macos/Contents/MacOS/
	mv ./macos ./Springbok.app
