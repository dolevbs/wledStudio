WLED_REF ?= origin/main

.PHONY: sync-wled wasm clean

sync-wled:
	git submodule update --init --remote vendor/WLED vendor/FastLED
	cd vendor/WLED && git fetch origin && git checkout $(WLED_REF)
	scripts/pin_wled_commit.sh

wasm: sync-wled
	scripts/build_wasm.sh

clean:
	rm -f public/wasm/wled.wasm public/wasm/wled.js
