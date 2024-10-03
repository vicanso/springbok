.PHONY: default macos

lint:
	cd src-tauri
	cargo clippy
fmt:
	cd src-tauri
	cargo fmt --all --
dev:
	npm run tauri dev
dev-web:
	npm run dev

release:
	cargo build --release
macos:
	mv ./target/release/springbok ./macos/Contents/MacOS/
	mv ./macos ./Springbok.app
