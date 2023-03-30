# global-config

    -P  No periodic status updates
    -a value
        Script arguments accessed with %{0}, %{1}, ...Escape % with \ if needed
    -e string
        Exclude list, will be filled with dev_id's of successfull devices, so they won't be walked again next run
    -f string
        Script file name (required)
    -l Live log instead of full log afer all finished. May get messy, use for single dev with -q, -P options
    -q No dev start and stop messages, no summary results, no periodic updates (implies -P)
    -r Log input from device
    -s  Print summary results for all worked and skipped devs
    -v  Log execution
    -w  Log sent commands to device

## Script syntax

Use single space before regexp or value, otherwise it will be part of it

If you need to regexp a space, better use (?: ) style, for visibility

Watch for trailing spaces after regexp or value, they will also be a part of it

Regexp syntax is of golang, see https://golang.org/s/re2syntax for details

Tip: use (?i)blahblah for case insensitive match

Tip: use (?ms) for multiline match/capture

    # this is comment
    # comments are olny allowed on separate line
    # empty or space only lines are skipped

    start
      denotes the point, from which device pre-selection ends, must not be preceeded with e, ef or p
      any e, ef or p also denotes this point
      not preselected devices will not be worked at all
      preselection is done by root-level match and !match

    end
      stops script execution right away

    user username
    pass password
      if no username is set, both username AND password will be asked from user
      if password is _ASK_ then it will be asked
      if password is not set - it's empty
      username and password are not subject to variable substitution

    pager_reg regexp
    pager_cmd cmd
      If input match pager_reg then issue pager_cmd

    eol eol_string
      EOL strings after command, \n by default, some alien devices want \r instead
      \n, \r, \t, \a, \b, \f, \v are replaced with corresponding code

    p command
      Send command to device, no EOL chars needed, they will be added using eol option

    e NUM regexp
      Wait at most NUM seconds for input matching regexp. If wait times out - script execution ends with error

    ef NUM regexp FAILON regexp
      Wait at most NUM seconds for input matching regexp. If wait times out - script execution ends with error
      If input matches second regexp, then script execution ends immediately

    capres varname regexp
      Capture output of e or ef into variable, matching regexp
      If regexp contains capture group, then it's value is captured, otherwise all regexp match
      example: (?ms).* - captures everything
      example: (?m)^ (shutdown)$ captures "shutdown" only

    setvar varname value
      Set value to varname

    log value
      Log value to device log buffer and printed after all finished, or immediately if -l option used

    per_int
      Cycle through interfaces_sorted array of device. Interface data can be accesses with %{int.AttrName}
      Must end with end_int, cannod be nested with per_int, can have sect's inside.
      Failed matches will skip to end_int and start with another interface if any left

    end_int
      Ends per_int section if no more interfaces left in list or looping back to per_int

    sect
      Start section. Failed matches will skip to else or end_sect
      Can be nested, can have per_int, can be inside per_int

    else
      Part of sect. Failed matches will skip to next else or end_sect

    end_sect
      Ends section

    match value regexp
    !match value regexp
      Test value against regexp. Failing "match", or not failing "!match" will result:
      - in root section - end script
      - in sect - skip to next else or end_sect
      - in per_int - work next interface or go to after end_int if none left

    nums_cross list1 list2
    !nums_cross list1 list2
      Check if lists on numbers like 1,5-8,344 intersect
      Resulting is action same as for "match" and "!match"

    list_splitter regexp
      extract items from list, fed to list_splitter.FindAllString , default "(\d+-\d+)|(\d+)"

    list_ranger regexp
      range delimeter, default "-"
      use (?: ) for matches with spaces

