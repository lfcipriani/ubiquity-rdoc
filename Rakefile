require 'erb'

task :default => %w[update]

desc "Update the rdoc.xhtml file"
task :update  => %w[rdoc.xhtml]

file 'rdoc.xhtml' => %w[rdoc.xhtml.erb rdoc.js] do
  template = File.read('rdoc.xhtml.erb')
  javascript = File.read('rdoc.js').chomp

  File.open('rdoc.xhtml', 'w', 0444) { |f|
    f.puts ERB.new(template).result(binding)
  }
end
