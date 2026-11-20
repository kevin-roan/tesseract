framework = File.join(__dir__, 'Tailnet.xcframework')
linked = File.directory?(framework)

unless linked
  Pod::UI.warn 'TesseractTailnet: ios/Tailnet.xcframework is missing, so the Tesseract Network is disabled in this build. ' \
               'Run native/tailnet/scripts/build-ios.sh on macOS, then pod install again.'
end

Pod::Spec.new do |s|
  s.name           = 'TesseractTailnet'
  s.version        = '1.0.0'
  s.summary        = 'Embedded Tesseract Network node for Tesseract'
  s.description    = 'Expo module that runs the tsnet-based tailnet library in the app process and forwards loopback ports to tailnet hosts.'
  s.author         = 'Tesseract'
  s.homepage       = 'https://github.com/kevin-roan/tesseract'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
  s.exclude_files = "Tailnet.xcframework/**/*"
  s.vendored_frameworks = 'Tailnet.xcframework' if linked
  s.frameworks = 'Network', 'SystemConfiguration'
  s.libraries = 'resolv'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
