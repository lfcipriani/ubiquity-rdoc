require 'erb'

begin
  require 'rubygems'
  require 'nuggets/file/which'
rescue LoadError
end

task :default => %w[update]

desc "Update the rdoc.xhtml file"
task :update  => %w[rdoc.xhtml]

file 'rdoc.xhtml' => %w[rdoc.xhtml.erb rdoc.js] do
  template = File.read('rdoc.xhtml.erb')
  javascript = File.read('rdoc.js').chomp

  result = ERB.new(template).result(binding)

  write = lambda {
    File.open('rdoc.xhtml', 'w', 0444) { |f| f.puts result }
  }

  begin
    write.call
  rescue Errno::EACCES
    FileUtils.rm_f('rdoc.xhtml')
    write.call
  end
end

desc "Run the rdoc.js file through JSLint"
task :jslint do
  rhino = File.respond_to?(:which) ? File.which('rhino') : ENV['RHINO']

  if rhino && File.executable?(rhino)
    jslint = ENV['JSLINT']

    if jslint && File.readable?(jslint)
      system(rhino, jslint, 'rdoc.js')
    else
      warn "JSLint not found: #{jslint} (Install from http://www.jslint.com/lint.html; specify JSLINT.)"
    end
  else
    warn 'Command not found: rhino (Install the rhino package; specify RHINO.)'
  end
end
